import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getSummary(userId: string, query: { startDate?: string; endDate?: string }) {
    const { startDate, endDate } = query;
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

    const entries = await this.prisma.moodEntry.findMany({
      where: whereClause,
      orderBy: { entryDate: 'asc' },
    });

    if (entries.length === 0) {
      return {
        totalEntries: 0,
        averageMood: 0,
        moodDistribution: { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 },
        tagCloud: {},
        trend: [],
      };
    }

    let totalScore = 0;
    const moodDistribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    const tagCloud: { [tag: string]: { count: number; averageMood: number; totalScore: number } } = {};

    const trend = entries.map(entry => {
      totalScore += entry.moodScore;
      
      const scoreStr = entry.moodScore.toString() as '1' | '2' | '3' | '4' | '5';
      if (scoreStr in moodDistribution) {
        moodDistribution[scoreStr]++;
      }

      if (entry.tags && entry.tags.length > 0) {
        entry.tags.forEach(tag => {
          if (!tagCloud[tag]) {
            tagCloud[tag] = { count: 0, averageMood: 0, totalScore: 0 };
          }
          tagCloud[tag].count++;
          tagCloud[tag].totalScore += entry.moodScore;
        });
      }

      return {
        id: entry.id,
        date: entry.entryDate,
        moodScore: entry.moodScore,
      };
    });

    const finalTagCloud: { [tag: string]: { count: number; averageMood: number } } = {};
    for (const tag in tagCloud) {
      finalTagCloud[tag] = {
        count: tagCloud[tag].count,
        averageMood: parseFloat((tagCloud[tag].totalScore / tagCloud[tag].count).toFixed(2)),
      };
    }

    const averageMood = parseFloat((totalScore / entries.length).toFixed(2));

    return {
      totalEntries: entries.length,
      averageMood,
      moodDistribution,
      tagCloud: finalTagCloud,
      trend,
    };
  }
}
