import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodDto } from './dto/create-mood.dto';
import { UpdateMoodDto } from './dto/update-mood.dto';

@Injectable()
export class MoodService {
  constructor(private prisma: PrismaService) {}

  async create(userId: string, createMoodDto: CreateMoodDto) {
    const { moodScore, note, tags, entryDate } = createMoodDto;
    
    return this.prisma.moodEntry.create({
      data: {
        userId,
        moodScore,
        note,
        tags: tags || [],
        entryDate: entryDate ? new Date(entryDate) : new Date(),
      },
    });
  }

  async findAll(userId: string, query: { startDate?: string; endDate?: string; tag?: string }) {
    const { startDate, endDate, tag } = query;
    const whereClause: any = { userId };

    if (startDate || endDate) {
      whereClause.entryDate = {};
      if (startDate) {
        whereClause.entryDate.gte = new Date(startDate);
      }
      if (endDate) {
        whereClause.entryDate.lte = new Date(endDate);
      }
    }

    if (tag) {
      whereClause.tags = {
        has: tag,
      };
    }

    return this.prisma.moodEntry.findMany({
      where: whereClause,
      orderBy: {
        entryDate: 'desc',
      },
    });
  }

  async findOne(userId: string, id: string) {
    const moodEntry = await this.prisma.moodEntry.findFirst({
      where: { id, userId },
    });

    if (!moodEntry) {
      throw new NotFoundException(`Mood entry with ID ${id} not found`);
    }

    return moodEntry;
  }

  async update(userId: string, id: string, updateMoodDto: UpdateMoodDto) {
    await this.findOne(userId, id);

    const { moodScore, note, tags, entryDate } = updateMoodDto;
    const updateData: any = {};

    if (moodScore !== undefined) updateData.moodScore = moodScore;
    if (note !== undefined) updateData.note = note;
    if (tags !== undefined) updateData.tags = tags;
    if (entryDate !== undefined) updateData.entryDate = new Date(entryDate);

    return this.prisma.moodEntry.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(userId: string, id: string) {
    await this.findOne(userId, id);

    await this.prisma.moodEntry.delete({
      where: { id },
    });

    return { message: 'Mood entry successfully deleted' };
  }
}
