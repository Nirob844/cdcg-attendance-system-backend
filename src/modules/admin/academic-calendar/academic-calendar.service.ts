import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateAcademicCalendarDto } from './dto/create-academic-calendar.dto';
import { UpdateAcademicCalendarDto } from './dto/update-academic-calendar.dto';
import { GoogleCalendarService } from 'src/common/lib/calendar/GoogleCalendarService';

@Injectable()
export class AcademicCalendarService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly googleCalendar: GoogleCalendarService,
  ) {}

  async createEvent(dto: CreateAcademicCalendarDto) {
    if (!dto.end_date) {
      dto.end_date = dto.start_date;
    }

    // 1. Create event in Google Calendar
    const googleEvent = await this.googleCalendar.createEvent('primary', {
      summary: dto.title,
      description: dto.description,
      start: { dateTime: dto.start_date },
      end: { dateTime: dto.end_date },
      location: dto.location,
      colorId: dto.color,
      // ...other Google event fields as needed
    });

    // 2. Save to local DB with google_event_id
    const data = await this.prisma.academicCalendar.create({
      data: {
        ...dto,
        google_event_id: googleEvent.id,
        synced: true,
      },
    });

    return { success: true, data };
  }

  async getEventsWithHolidays(startDate?: string, endDate?: string) {
    // 1. Get your own events
    const data = await this.prisma.academicCalendar.findMany({
      where: {
        start_date: startDate ? { gte: new Date(startDate) } : undefined,
        end_date: endDate ? { lte: new Date(endDate) } : undefined,
        deleted_at: null,
      },
      orderBy: { start_date: 'asc' },
    });

    // 2. Get Portugal public holidays from Google
    const holidays = await this.googleCalendar.listEvents(
      'pt.portuguese#holiday@group.v.calendar.google.com',
      startDate,
      endDate,
    );

    // 3. Return both in the response
    return {
      success: true,
      data: {
        events: data,
        holidays,
      },
    };
  }

  async updateEvent(id: string, updates: UpdateAcademicCalendarDto) {
    const event = await this.prisma.academicCalendar.findUnique({
      where: { id },
    });
    if (!event) throw new Error('Event not found');

    // Update Google Calendar event if exists
    if (event.google_event_id) {
      await this.googleCalendar.updateEvent('primary', event.google_event_id, {
        summary: updates.title ?? event.title,
        description: updates.description ?? event.description,
        start: {
          dateTime: new Date(
            updates.start_date ?? event.start_date,
          ).toISOString(),
        },
        end: {
          dateTime: new Date(updates.end_date ?? event.end_date).toISOString(),
        },
        location: updates.location ?? event.location,
      });
    }

    // Update database record
    const data = await this.prisma.academicCalendar.update({
      where: { id },
      data: {
        ...updates,
        start_date: updates.start_date ?? event.start_date,
        end_date: updates.end_date ?? event.end_date,
      },
    });
    return { success: true, data };
  }

  async deleteEvent(id: string) {
    const event = await this.prisma.academicCalendar.findUnique({
      where: { id },
    });
    if (!event) throw new Error('Event not found');

    // Delete from Google Calendar if exists
    if (event.google_event_id) {
      await this.googleCalendar.deleteEvent('primary', event.google_event_id);
    }

    // Delete from database
    const data = await this.prisma.academicCalendar.delete({ where: { id } });
    return { success: true, data };
  }

  async getCalendarWithHolidays(startDate: string, endDate: string) {
    // 1. Get your own events
    const localEvents = await this.prisma.academicCalendar.findMany({
      where: {
        start_date: { gte: new Date(startDate), lte: new Date(endDate) },
        deleted_at: null,
      },
    });

    // 2. Get Portugal public holidays from Google
    const holidays = await this.googleCalendar.listEvents(
      'pt.portuguese#holiday@group.v.calendar.google.com',
      startDate,
      endDate,
    );

    // 3. Combine and return in { success, data } format
    return {
      success: true,
      data: {
        localEvents,
        holidays,
      },
    };
  }
}
