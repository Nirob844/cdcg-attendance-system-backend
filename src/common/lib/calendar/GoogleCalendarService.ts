import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { google, calendar_v3 } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';
import appConfig from 'src/config/app.config';

@Injectable()
export class GoogleCalendarService implements OnModuleInit {
  private readonly logger = new Logger(GoogleCalendarService.name);
  private oauth2Client: OAuth2Client;
  private calendar: calendar_v3.Calendar;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.initializeClient();
  }

  private initializeClient() {
    const googleConfig = appConfig().auth.google;
    this.oauth2Client = new google.auth.OAuth2(
      googleConfig.app_id,
      googleConfig.app_secret,
      googleConfig.callback,
    );

    // Set credentials (refresh token is recommended)
    const refreshToken = appConfig().auth.google.refresh_token;
    if (refreshToken) {
      this.oauth2Client.setCredentials({ refresh_token: refreshToken });
    } else {
      this.logger.warn(
        'No Google Calendar refresh token set. API calls may fail.',
      );
    }

    this.calendar = google.calendar({
      version: 'v3',
      auth: this.oauth2Client,
    });
  }

  // Create a new event
  async createEvent(
    calendarId: string,
    event: calendar_v3.Schema$Event,
  ): Promise<calendar_v3.Schema$Event> {
    const res = await this.calendar.events.insert({
      calendarId,
      requestBody: event,
    });
    return res.data;
  }

  // List events
  async listEvents(
    calendarId: string,
    timeMin?: string,
    timeMax?: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const res = await this.calendar.events.list({
      calendarId,
      timeMin,
      timeMax,
      singleEvents: true,
      orderBy: 'startTime',
    });
    return res.data.items || [];
  }

  // Update an event
  async updateEvent(
    calendarId: string,
    eventId: string,
    event: calendar_v3.Schema$Event,
  ): Promise<calendar_v3.Schema$Event> {
    const res = await this.calendar.events.update({
      calendarId,
      eventId,
      requestBody: event,
    });
    return res.data;
  }

  // Delete an event
  async deleteEvent(calendarId: string, eventId: string): Promise<void> {
    await this.calendar.events.delete({
      calendarId,
      eventId,
    });
  }

  // List Portugal public holidays
  async listPortugalHolidays(
    timeMin: string,
    timeMax: string,
  ): Promise<calendar_v3.Schema$Event[]> {
    const holidays = await this.listEvents(
      'pt.portuguese#holiday@group.v.calendar.google.com',
      timeMin,
      timeMax,
    );
    return holidays;
  }
}
