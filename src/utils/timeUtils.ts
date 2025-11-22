/**
 * open-nof1.ai - AI 加密货币自动交易系统
 * Copyright (C) 2025 195440
 * 
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 * 
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 * 
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

/**
 * 时间工具模块 - 统一使用中国时间（UTC+8）
 */

/**
 * 获取当前中国时间的 ISO 字符串
 * @returns 中国时间的 ISO 格式字符串
 */
export function getChinaTimeISO(): string {
  const now = new Date();
  
  // 使用 toLocaleString 获取中国时间，然后转换为 ISO 格式
  const chinaTimeString = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 转换格式：从 "2025/10/23 08:30:45" 到 "2025-10-23T08:30:45+08:00"
  const [datePart, timePart] = chinaTimeString.split(' ');
  const isoDate = datePart.replace(/\//g, '-');
  return `${isoDate}T${timePart}+08:00`;
}

/**
 * 格式化中国时间为易读格式
 * @param date 日期对象或 ISO 字符串
 * @returns 格式化的中国时间字符串，如 "2025-10-22 14:30:45"
 */
export function formatChinaTime(date?: Date | string): string {
  let d: Date;
  
  if (!date) {
    d = new Date();
  } else if (typeof date === 'string') {
    d = new Date(date);
  } else {
    d = date;
  }
  
  // 使用 toLocaleString 方法直接获取中国时间
  const chinaTimeString = d.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 转换格式：从 "2025/10/23 08:30:45" 到 "2025-10-23 08:30:45"
  return chinaTimeString.replace(/\//g, '-');
}

/**
 * 获取中国时间的日期对象
 * @returns 中国时间的 Date 对象（注意：Date对象本身不存储时区，只是调整了时间值）
 */
export function getChinaTime(): Date {
  const now = new Date();
  
  // 使用 toLocaleString 获取中国时间字符串
  const chinaTimeString = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 解析并创建新的Date对象
  // 格式: "2025/10/23 08:30:45"
  const [datePart, timePart] = chinaTimeString.split(' ');
  const [year, month, day] = datePart.split('/');
  const [hour, minute, second] = timePart.split(':');
  
  // 创建UTC时间，但值对应中国时间
  return new Date(Date.UTC(
    parseInt(year),
    parseInt(month) - 1,
    parseInt(day),
    parseInt(hour),
    parseInt(minute),
    parseInt(second)
  ));
}

/**
 * 将 UTC 时间转换为中国时间字符串
 * @param utcDate UTC 时间
 * @returns 中国时间字符串
 */
export function utcToChinaTime(utcDate: Date | string): string {
  const d = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return formatChinaTime(d);
}

/**
 * 获取中国时间戳（毫秒）
 * @returns 中国时间的时间戳
 */
export function getChinaTimestamp(): number {
  return getChinaTime().getTime();
}

/**
 * 判断当前是否为美股夏令时
 * 夏令时：每年3月第二个周日至11月第一个周日
 * 冬令时：每年11月第一个周日至次年3月第二个周日
 */
export function isUsaDaylightSavingTime(): boolean {
  const now = new Date();
  const year = now.getFullYear();
  
  // 夏令时开始：3月第二个周日 2:00 AM
  const marchFirst = new Date(year, 2, 1);
  const marchFirstDay = marchFirst.getDay();
  const daylightStart = new Date(year, 2, (14 - marchFirstDay) % 7);
  daylightStart.setHours(2, 0, 0, 0);
  
  // 夏令时结束：11月第一个周日 2:00 AM
  const novemberFirst = new Date(year, 10, 1);
  const novemberFirstDay = novemberFirst.getDay();
  const daylightEnd = new Date(year, 10, (7 - novemberFirstDay) % 7 + 1);
  daylightEnd.setHours(2, 0, 0, 0);
  
  return now >= daylightStart && now < daylightEnd;
}

/**
 * 获取美股收盘时间（北京时间）
 * @returns {start: number, end: number} 美股收盘时间段的开始和结束小时
 */
export function getUsMarketCloseTime(): {start: number, end: number} {
  const isDaylight = isUsaDaylightSavingTime();
  
  // 夏令时：美股收盘时间 4:00-6:00
  // 冬令时：美股收盘时间 5:00-7:00
  if (isDaylight) {
    return { start: 4, end: 6 };
  } else {
    return { start: 5, end: 7 };
  }
}

/**
 * 判断当前是否为低波动时期（周六或美股收盘时间）
 * @returns 如果是低波动时期返回true，否则返回false
 */
export function isLowVolatilityPeriod(): boolean {
  const now = new Date();
  
  // 使用 toLocaleString 获取中国时间字符串
  const chinaTimeString = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 解析中国时间字符串获取星期几和小时
  const [datePart, timePart] = chinaTimeString.split(' ');
  const [hourStr] = timePart.split(':');
  const hour = parseInt(hourStr);
  
  // 解析日期部分获取星期几
  const [year, month, day] = datePart.split('/');
  const chinaDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const dayOfWeek = chinaDate.getDay(); // 0=周日, 1=周一, ..., 6=周六
  
  // 周六（全天）
  if (dayOfWeek === 6) {
    return true;
  }
  
  // 美股收盘时间（动态调整夏令时/冬令时）
  const usCloseTime = getUsMarketCloseTime();
  if (hour >= usCloseTime.start && hour < usCloseTime.end) {
    return true;
  }
  
  // 周日凌晨（0点-6点）
  if (dayOfWeek === 0 && hour < 6) {
    return true;
  }
  
  return false;
}

/**
 * 获取低波动时期描述
 * @returns 低波动时期的描述字符串
 */
export function getLowVolatilityDescription(): string {
  const now = new Date();
  
  // 使用 toLocaleString 获取中国时间字符串
  const chinaTimeString = now.toLocaleString('zh-CN', { 
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });
  
  // 解析中国时间字符串获取星期几和小时
  const [datePart, timePart] = chinaTimeString.split(' ');
  const [hourStr] = timePart.split(':');
  const hour = parseInt(hourStr);
  
  // 解析日期部分获取星期几
  const [year, month, day] = datePart.split('/');
  const chinaDate = new Date(parseInt(year), parseInt(month) - 1, parseInt(day));
  const dayOfWeek = chinaDate.getDay();
  
  if (dayOfWeek === 6) {
    return "周六（全天低波动）";
  }
  
  // 美股收盘时间（动态调整夏令时/冬令时）
  const usCloseTime = getUsMarketCloseTime();
  if (hour >= usCloseTime.start && hour < usCloseTime.end) {
    const season = isUsaDaylightSavingTime() ? "夏令时" : "冬令时";
    return `美股收盘时间（凌晨${usCloseTime.start}-${usCloseTime.end}点，${season}）`;
  }
  
  if (dayOfWeek === 0 && hour < 6) {
    return "周日凌晨（0-6点）";
  }
  
  return "正常交易时段";
}

