import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateProductDto } from './dto/create-product.dto.js';
import { UpdateProductDto } from './dto/update-product.dto.js';
import { ListProductsDto } from './dto/list-products.dto.js';

@Injectable()
export class ProductsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateProductDto) {
    try {
      return await this.prisma.product.create({ data: { ...dto, userId } });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
      throw err;
    }
  }

  async findAll(userId: string, query: ListProductsDto) {
    const where: Prisma.ProductWhereInput = {
      userId,
      ...(query.search
        ? {
            OR: [
              { name: { contains: query.search, mode: 'insensitive' } },
              { sku: { contains: query.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total] = await this.prisma.$transaction([
      this.prisma.product.findMany({
        where,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { items, total, page: query.page, pageSize: query.pageSize };
  }

  async findOne(userId: string, id: string) {
    const product = await this.prisma.product.findFirst({ where: { id, userId } });
    if (!product) throw new NotFoundException('Product not found');
    return product;
  }

  async update(userId: string, id: string, dto: UpdateProductDto) {
    await this.findOne(userId, id);
    try {
      return await this.prisma.product.update({ where: { id }, data: dto });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        throw new ConflictException(`SKU "${dto.sku}" is already in use`);
      }
      throw err;
    }
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);
    const usedInInvoice = await this.prisma.invoiceItem.findFirst({ where: { productId: id } });
    if (usedInInvoice) {
      throw new ConflictException('Product is referenced by an existing invoice and cannot be deleted');
    }
    await this.prisma.product.delete({ where: { id } });
    return { success: true };
  }
}
