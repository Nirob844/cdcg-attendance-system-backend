import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
import * as timezone from 'dayjs/plugin/timezone';

const dayjsInstance = (dayjs as any).default || dayjs;
const utcPlugin = (utc as any).default || utc;
const timezonePlugin = (timezone as any).default || timezone;

dayjsInstance.extend(utcPlugin);
dayjsInstance.extend(timezonePlugin);

export const APP_TIMEZONE = 'Europe/Lisbon';

export const toUtc = (value?: string | Date) => {
  if (!value) return undefined;
  const str = typeof value === 'string' ? value : new Date(value).toISOString();
  return dayjsInstance.tz(str, APP_TIMEZONE).toDate();
};

export const toLisbon = (value: string | Date) => {
  return dayjsInstance(value).tz(APP_TIMEZONE).toDate();
};
