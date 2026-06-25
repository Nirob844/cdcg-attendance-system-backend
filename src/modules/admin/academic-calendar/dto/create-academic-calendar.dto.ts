import {
  IsString,
  IsOptional,
  IsDateString,
  IsEnum,
  IsBoolean,
  IsInt,
} from 'class-validator';

export enum CalendarEventType {
  OFF_DAY = 'OFF_DAY',
  HOLIDAY = 'HOLIDAY',
  SEMINAR = 'SEMINAR',
  EXAM_DAY = 'EXAM_DAY',
}

export class CreateAcademicCalendarDto {
  @IsOptional()
  @IsInt()
  status?: number;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsEnum(CalendarEventType)
  event_type: CalendarEventType;

  @IsOptional()
  @IsDateString()
  start_date?: string;

  @IsOptional()
  @IsDateString()
  end_date?: string;

  @IsOptional()
  @IsBoolean()
  all_day?: boolean;

  @IsOptional()
  @IsString()
  location?: string;

  @IsOptional()
  @IsString()
  organizer?: string;

  @IsOptional()
  @IsString()
  color?: string;

  // Google Calendar fields
  @IsOptional()
  @IsString()
  google_event_id?: string;

  @IsOptional()
  @IsBoolean()
  synced?: boolean;
}
