import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateInvoiceDto } from './dto/create-invoice.dto.js';
import { UpdateInvoiceDto } from './dto/update-invoice.dto.js';
import { ListInvoicesDto } from './dto/list-invoices.dto.js';

const TAX_RATE_PERCENT = Number(process.env.TAX_RATE_PERCENT ?? 11);

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  private calcTotals(lines: { unitPrice: number; quantity: number }[]) {
    const subtotal = lines.reduce((sum, l) => sum + l.unitPrice * l.quantity, 0);
    const taxAmount = Math.round((subtotal * TAX_RATE_PERCENT) / 100);
    return { subtotal, taxAmount, total: subtotal + taxAmount };
  }

  private async nextInvoiceNumber(tx: Prisma.TransactionClient) {
    const year = new Date().getFullYear();
    const counter = await tx.invoiceCounter.upsert({
      where: { year },
      update: { value: { increment: 1 } },
      create: { year, value: 1 },
    });
    return `INV-${year}-${String(counter.value).padStart(4, '0')}`;
  }

  private async buildLines(tx: Prisma.TransactionClient, userId: string, items: { productId: string; quantity: number }[]) {
    const productIds = items.map((i) => i.productId);
    const products = await tx.product.findMany({ where: { id: { in: productIds }, userId } });
    const byId = new Map(products.map((p) => [p.id, p]));

    return items.map((item) => {
      const product = byId.get(item.productId);
      if (!product) {
        throw new NotFoundException(`Product ${item.productId} not found`);
      }
      if (item.quantity > product.quantityOnHand) {
        throw new BadRequestException(
          `Insufficient stock for "${product.name}": requested ${item.quantity}, available ${product.quantityOnHand}`,
        );
      }
      return {
        productId: product.id,
        productName: product.name,
        unitPrice: product.unitPrice,
        quantity: item.quantity,
        lineTotal: product.unitPrice * item.quantity,
      };
    });
  }

  async create(userId: string, dto: CreateInvoiceDto) {
    return this.prisma.$transaction(async (tx) => {
      const lines = await this.buildLines(tx, userId, dto.items);
      const { subtotal, taxAmount, total } = this.calcTotals(lines);
      const invoiceNumber = await this.nextInvoiceNumber(tx);

      return tx.invoice.create({
        data: {
          userId,
          invoiceNumber,
          customerName: dto.customerName,
          issueDate: new Date(dto.issueDate),
          dueDate: new Date(dto.dueDate),
          notes: dto.notes,
          status: InvoiceStatus.DRAFT,
          subtotal,
          taxAmount,
          total,
          items: { create: lines },
        },
        include: { items: true },
      });
    });
  }

  async findAll(userId: string, query: ListInvoicesDto) {
    const where: Prisma.InvoiceWhereInput = { userId, ...(query.status ? { status: query.status } : {}) };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(userId: string, id: string) {
    const invoice = await this.prisma.invoice.findFirst({ where: { id, userId }, include: { items: true } });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return invoice;
  }

  async update(userId: string, id: string, dto: UpdateInvoiceDto) {
    const existing = await this.findOne(userId, id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException('Only DRAFT invoices can be edited');
    }

    return this.prisma.$transaction(async (tx) => {
      const items = dto.items ?? existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity }));
      const lines = await this.buildLines(tx, userId, items);
      const { subtotal, taxAmount, total } = this.calcTotals(lines);

      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      return tx.invoice.update({
        where: { id },
        data: {
          customerName: dto.customerName ?? existing.customerName,
          issueDate: dto.issueDate ? new Date(dto.issueDate) : existing.issueDate,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : existing.dueDate,
          notes: dto.notes ?? existing.notes,
          subtotal,
          taxAmount,
          total,
          items: { create: lines },
        },
        include: { items: true },
      });
    });
  }

  async issue(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    if (existing.status !== InvoiceStatus.DRAFT) {
      throw new ConflictException(`Cannot issue an invoice with status ${existing.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        // Conditional UPDATE ... WHERE quantityOnHand >= quantity makes the
        // check-and-decrement atomic at the row level, so two concurrent
        // issues can't both pass a separate read-then-write check.
        const result = await tx.product.updateMany({
          where: { id: item.productId, quantityOnHand: { gte: item.quantity } },
          data: { quantityOnHand: { decrement: item.quantity } },
        });
        if (result.count === 0) {
          const product = await tx.product.findUnique({ where: { id: item.productId } });
          throw new BadRequestException(
            `Insufficient stock for "${item.productName}": requested ${item.quantity}, available ${product?.quantityOnHand ?? 0}`,
          );
        }
      }
      return tx.invoice.update({ where: { id }, data: { status: InvoiceStatus.ISSUED }, include: { items: true } });
    });
  }

  async pay(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    // Guarding the UPDATE itself with the expected status (rather than just
    // checking-then-writing) makes this safe against two concurrent "mark
    // paid" clicks on the same invoice: Postgres's row lock on the UPDATE
    // serializes them, and the loser's WHERE no longer matches.
    const result = await this.prisma.invoice.updateMany({
      where: { id, userId, status: InvoiceStatus.ISSUED },
      data: { status: InvoiceStatus.PAID },
    });
    if (result.count === 0) {
      throw new ConflictException(`Cannot mark as paid an invoice with status ${existing.status}`);
    }
    return this.findOne(userId, id);
  }

  async cancel(userId: string, id: string) {
    const existing = await this.findOne(userId, id);
    if (existing.status !== InvoiceStatus.DRAFT && existing.status !== InvoiceStatus.ISSUED) {
      throw new ConflictException(`Cannot cancel an invoice with status ${existing.status}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Same reasoning as pay(): the status guard lives on the UPDATE
      // itself so a concurrent duplicate cancel can't also pass the check
      // and restore stock a second time.
      const result = await tx.invoice.updateMany({
        where: { id, userId, status: existing.status },
        data: { status: InvoiceStatus.CANCELLED },
      });
      if (result.count === 0) {
        throw new ConflictException('Invoice status changed by another request, please retry');
      }

      if (existing.status === InvoiceStatus.ISSUED) {
        for (const item of existing.items) {
          await tx.product.update({
            where: { id: item.productId },
            data: { quantityOnHand: { increment: item.quantity } },
          });
        }
      }
      return tx.invoice.findUniqueOrThrow({ where: { id }, include: { items: true } });
    });
  }
}
