/**
 * API для работы с сообщениями чата
 * GET - получить сообщения за конкретную дату
 * POST - сохранить все сообщения за дату (перезапись)
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireUserId } from '@/lib/get-user-id';
import { z } from 'zod'

const StoredMessagesSchema = z.object({
  date: z.string().trim().min(1).max(32),
  messages: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string().max(4000),
  })).max(200),
})

export async function GET(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    // Получаем все сообщения за эту дату для этого пользователя
    const messages = await prisma.chatMessage.findMany({
      where: {
        userId,
        date,
      },
      orderBy: {
        createdAt: 'asc',
      },
      select: {
        role: true,
        content: true,
      },
    });

    return NextResponse.json({ messages });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to get chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to get chat messages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    const validation = StoredMessagesSchema.safeParse(await request.json())
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.error.format() },
        { status: 400 }
      )
    }

    const { date, messages } = validation.data

    // Транзакция: удаляем старые сообщения и создаём новые
    await prisma.$transaction(async (tx) => {
      // Удаляем все существующие сообщения за эту дату
      await tx.chatMessage.deleteMany({
        where: {
          userId,
          date,
        },
      });

      // Создаём новые сообщения
      if (messages.length > 0) {
        await tx.chatMessage.createMany({
          data: messages.map((msg) => ({
            userId,
            date,
            role: msg.role,
            content: msg.content,
          })),
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to save chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to save chat messages' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const userId = await requireUserId(request);
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');

    if (!date) {
      return NextResponse.json(
        { error: 'Date parameter is required' },
        { status: 400 }
      );
    }

    // Удаляем все сообщения за эту дату
    await prisma.chatMessage.deleteMany({
      where: {
        userId,
        date,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('Failed to delete chat messages:', error);
    return NextResponse.json(
      { error: 'Failed to delete chat messages' },
      { status: 500 }
    );
  }
}
