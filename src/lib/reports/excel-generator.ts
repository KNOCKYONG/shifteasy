/**
 * Excel Report Generator using ExcelJS
 */

import ExcelJS from 'exceljs';

export interface ScheduleData {
  date: Date;
  employeeName: string;
  employeeId: string;
  shift: string;
  hours: number;
  department: string;
  notes?: string;
}

export interface KPIData {
  metric: string;
  value: number;
  target: number;
  trend: 'up' | 'down' | 'stable';
  period: string;
}

export class ExcelReportGenerator {
  private workbook: ExcelJS.Workbook;

  constructor() {
    this.workbook = new ExcelJS.Workbook();
    this.setupWorkbook();
  }

  private setupWorkbook(): void {
    this.workbook.creator = 'ShiftEasy';
    this.workbook.lastModifiedBy = 'ShiftEasy System';
    this.workbook.created = new Date();
    this.workbook.modified = new Date();
  }

  /**
   * Generate monthly schedule report
   */
  async generateScheduleReport(
    scheduleData: ScheduleData[],
    month: string,
    year: number
  ): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet(`Schedule ${month} ${year}`);

    // Setup columns
    worksheet.columns = [
      { header: 'Date', key: 'date', width: 15 },
      { header: 'Employee ID', key: 'employeeId', width: 12 },
      { header: 'Employee Name', key: 'employeeName', width: 20 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Shift', key: 'shift', width: 12 },
      { header: 'Hours', key: 'hours', width: 10 },
      { header: 'Notes', key: 'notes', width: 30 },
    ];

    // Style the header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2E7D32' },
    };
    worksheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };

    // Add data
    scheduleData.forEach((record) => {
      const row = worksheet.addRow({
        date: record.date,
        employeeId: record.employeeId,
        employeeName: record.employeeName,
        department: record.department,
        shift: record.shift,
        hours: record.hours,
        notes: record.notes || '',
      });

      // Format date cell
      row.getCell('date').numFmt = 'yyyy-mm-dd';
    });

    // Add borders
    worksheet.eachRow((row, rowNumber) => {
      row.eachCell((cell) => {
        cell.border = {
          top: { style: 'thin' },
          left: { style: 'thin' },
          bottom: { style: 'thin' },
          right: { style: 'thin' },
        };
      });
    });

    // Add summary
    const summaryRow = worksheet.addRow([]);
    summaryRow.getCell(1).value = 'Total Hours:';
    summaryRow.getCell(1).font = { bold: true };
    summaryRow.getCell(6).value = {
      formula: `SUM(F2:F${worksheet.rowCount - 1})`,
    };
    summaryRow.getCell(6).font = { bold: true };

    // Auto-filter
    worksheet.autoFilter = {
      from: 'A1',
      to: `G${worksheet.rowCount - 1}`,
    };

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Generate KPI dashboard report
   */
  async generateKPIReport(
    kpiData: KPIData[],
    period: string
  ): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet(`KPI Dashboard - ${period}`);

    // Setup columns
    worksheet.columns = [
      { header: 'Metric', key: 'metric', width: 30 },
      { header: 'Current Value', key: 'value', width: 15 },
      { header: 'Target', key: 'target', width: 15 },
      { header: 'Achievement %', key: 'achievement', width: 15 },
      { header: 'Trend', key: 'trend', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
    ];

    // Style the header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E88E5' },
    };

    // Add data with conditional formatting
    kpiData.forEach((kpi) => {
      const achievement = (kpi.value / kpi.target) * 100;
      const status = achievement >= 100 ? 'On Target' : achievement >= 80 ? 'Near Target' : 'Below Target';

      const row = worksheet.addRow({
        metric: kpi.metric,
        value: kpi.value,
        target: kpi.target,
        achievement: achievement,
        trend: kpi.trend,
        status: status,
      });

      // Format achievement cell
      row.getCell('achievement').numFmt = '0.00"%"';

      // Color code status
      const statusCell = row.getCell('status');
      if (status === 'On Target') {
        statusCell.font = { color: { argb: 'FF008000' } };
      } else if (status === 'Near Target') {
        statusCell.font = { color: { argb: 'FFFFA500' } };
      } else {
        statusCell.font = { color: { argb: 'FFFF0000' } };
      }

      // Add trend arrow
      const trendCell = row.getCell('trend');
      if (kpi.trend === 'up') {
        trendCell.value = '↑ ' + kpi.trend;
        trendCell.font = { color: { argb: 'FF008000' } };
      } else if (kpi.trend === 'down') {
        trendCell.value = '↓ ' + kpi.trend;
        trendCell.font = { color: { argb: 'FFFF0000' } };
      } else {
        trendCell.value = '→ ' + kpi.trend;
        trendCell.font = { color: { argb: 'FF808080' } };
      }
    });

    // Add chart placeholder comment
    worksheet.addComment('A1', {
      text: 'Charts can be added programmatically or in Excel after export',
      author: 'ShiftEasy',
    });

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Generate employee summary report
   */
  async generateEmployeeSummary(
    employeeData: any[],
    period: string
  ): Promise<Buffer> {
    const worksheet = this.workbook.addWorksheet(`Employee Summary - ${period}`);

    // Setup columns
    worksheet.columns = [
      { header: 'Employee ID', key: 'id', width: 12 },
      { header: 'Name', key: 'name', width: 20 },
      { header: 'Department', key: 'department', width: 15 },
      { header: 'Total Hours', key: 'totalHours', width: 12 },
      { header: 'Overtime Hours', key: 'overtimeHours', width: 15 },
      { header: 'Shifts Worked', key: 'shiftsWorked', width: 12 },
      { header: 'Attendance %', key: 'attendance', width: 12 },
    ];

    // Style header
    worksheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    worksheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF4CAF50' },
    };

    // Add data
    employeeData.forEach((employee) => {
      const row = worksheet.addRow(employee);

      // Format percentage
      row.getCell('attendance').numFmt = '0.00"%"';

      // Highlight high performers
      if (employee.attendance >= 95) {
        row.getCell('attendance').fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE8F5E9' },
        };
      }
    });

    // Add conditional formatting for overtime
    const overtimeColumn = worksheet.getColumn('overtimeHours');
    worksheet.conditionalFormattings.addConditionalFormatting({
      ref: `E2:E${worksheet.rowCount}`,
      rules: [
        {
          type: 'cellIs',
          operator: 'greaterThan',
          priority: 1,
          style: {
            fill: {
              type: 'pattern',
              pattern: 'solid',
              fgColor: { argb: 'FFFFEBEE' },
            },
            font: {
              color: { argb: 'FFD32F2F' },
            },
          },
          formulae: [40],
        },
      ],
    });

    return await this.workbook.xlsx.writeBuffer() as Buffer;
  }

  /**
   * Reset workbook for new report
   */
  reset(): void {
    this.workbook = new ExcelJS.Workbook();
    this.setupWorkbook();
  }
}

export const excelGenerator = new ExcelReportGenerator();