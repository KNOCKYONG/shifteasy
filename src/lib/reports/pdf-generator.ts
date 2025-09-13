/**
 * PDF Report Generator using jsPDF
 */

import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface PDFReportOptions {
  title: string;
  subtitle?: string;
  author?: string;
  date?: Date;
  orientation?: 'portrait' | 'landscape';
}

export class PDFReportGenerator {
  private doc: jsPDF;
  private currentY: number = 20;
  private pageWidth: number;
  private pageHeight: number;
  private margin: number = 20;

  constructor(options: PDFReportOptions = { title: 'Report' }) {
    this.doc = new jsPDF({
      orientation: options.orientation || 'portrait',
      unit: 'mm',
      format: 'a4',
    });

    this.pageWidth = this.doc.internal.pageSize.getWidth();
    this.pageHeight = this.doc.internal.pageSize.getHeight();

    this.setupDocument(options);
  }

  private setupDocument(options: PDFReportOptions): void {
    // Set document properties
    this.doc.setProperties({
      title: options.title,
      author: options.author || 'ShiftEasy',
      creator: 'ShiftEasy System',
    });

    // Add header
    this.addHeader(options);
  }

  private addHeader(options: PDFReportOptions): void {
    // Title
    this.doc.setFontSize(20);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(options.title, this.pageWidth / 2, this.currentY, {
      align: 'center',
    });
    this.currentY += 10;

    // Subtitle
    if (options.subtitle) {
      this.doc.setFontSize(14);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(options.subtitle, this.pageWidth / 2, this.currentY, {
        align: 'center',
      });
      this.currentY += 8;
    }

    // Date
    const date = options.date || new Date();
    this.doc.setFontSize(10);
    this.doc.text(
      `Generated: ${date.toLocaleDateString()}`,
      this.pageWidth / 2,
      this.currentY,
      { align: 'center' }
    );
    this.currentY += 10;

    // Add line separator
    this.doc.setLineWidth(0.5);
    this.doc.line(this.margin, this.currentY, this.pageWidth - this.margin, this.currentY);
    this.currentY += 10;
  }

  /**
   * Generate schedule PDF
   */
  generateSchedulePDF(scheduleData: any[]): Uint8Array {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Monthly Schedule', this.margin, this.currentY);
    this.currentY += 10;

    // Create table
    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Date', 'Employee', 'Department', 'Shift', 'Hours', 'Notes']],
      body: scheduleData.map((item) => [
        new Date(item.date).toLocaleDateString(),
        item.employeeName,
        item.department,
        item.shift,
        item.hours.toString(),
        item.notes || '-',
      ]),
      theme: 'grid',
      headStyles: {
        fillColor: [46, 125, 50],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
      },
      alternateRowStyles: {
        fillColor: [245, 245, 245],
      },
      margin: { left: this.margin, right: this.margin },
    });

    // Add summary
    this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    const totalHours = scheduleData.reduce((sum, item) => sum + item.hours, 0);
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(`Total Hours: ${totalHours}`, this.margin, this.currentY);

    return this.doc.output('arraybuffer') as Uint8Array;
  }

  /**
   * Generate KPI dashboard PDF
   */
  generateKPIPDF(kpiData: any[]): Uint8Array {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('KPI Dashboard', this.margin, this.currentY);
    this.currentY += 10;

    // Create KPI table
    const tableData = kpiData.map((kpi) => {
      const achievement = ((kpi.value / kpi.target) * 100).toFixed(1);
      const status = parseFloat(achievement) >= 100 ? '✓' : parseFloat(achievement) >= 80 ? '~' : '✗';
      return [
        kpi.metric,
        kpi.value.toString(),
        kpi.target.toString(),
        `${achievement}%`,
        status,
      ];
    });

    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Metric', 'Current', 'Target', 'Achievement', 'Status']],
      body: tableData,
      theme: 'striped',
      headStyles: {
        fillColor: [30, 136, 229],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
      },
      columnStyles: {
        4: {
          halign: 'center',
          cellWidth: 15,
        },
      },
      didDrawCell: (data) => {
        // Color code status column
        if (data.column.index === 4 && data.cell.section === 'body') {
          const status = data.cell.text[0];
          if (status === '✓') {
            this.doc.setTextColor(0, 128, 0);
          } else if (status === '~') {
            this.doc.setTextColor(255, 165, 0);
          } else {
            this.doc.setTextColor(255, 0, 0);
          }
        }
      },
      margin: { left: this.margin, right: this.margin },
    });

    // Add chart placeholder
    this.currentY = (this.doc as any).lastAutoTable.finalY + 15;
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'italic');
    this.doc.setTextColor(128, 128, 128);
    this.doc.text(
      'Note: For detailed charts, please refer to the Excel report or dashboard.',
      this.pageWidth / 2,
      this.currentY,
      { align: 'center' }
    );

    return this.doc.output('arraybuffer') as Uint8Array;
  }

  /**
   * Generate employee summary PDF
   */
  generateEmployeeSummaryPDF(employeeData: any[]): Uint8Array {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Employee Summary Report', this.margin, this.currentY);
    this.currentY += 10;

    // Group by department
    const departments = [...new Set(employeeData.map(e => e.department))];

    departments.forEach((dept, index) => {
      if (index > 0) {
        this.doc.addPage();
        this.currentY = 20;
      }

      this.doc.setFontSize(12);
      this.doc.setFont('helvetica', 'bold');
      this.doc.text(`Department: ${dept}`, this.margin, this.currentY);
      this.currentY += 8;

      const deptEmployees = employeeData.filter(e => e.department === dept);

      autoTable(this.doc, {
        startY: this.currentY,
        head: [['ID', 'Name', 'Total Hours', 'Overtime', 'Shifts', 'Attendance']],
        body: deptEmployees.map((emp) => [
          emp.id,
          emp.name,
          emp.totalHours.toString(),
          emp.overtimeHours.toString(),
          emp.shiftsWorked.toString(),
          `${emp.attendance.toFixed(1)}%`,
        ]),
        theme: 'grid',
        headStyles: {
          fillColor: [76, 175, 80],
          textColor: 255,
          fontSize: 9,
          fontStyle: 'bold',
        },
        bodyStyles: {
          fontSize: 8,
        },
        margin: { left: this.margin, right: this.margin },
      });

      this.currentY = (this.doc as any).lastAutoTable.finalY + 10;
    });

    // Add footer on last page
    this.addFooter();

    return this.doc.output('arraybuffer') as Uint8Array;
  }

  /**
   * Generate shift pattern PDF
   */
  generateShiftPatternPDF(shiftData: any[]): Uint8Array {
    this.doc.setFontSize(14);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('Shift Pattern Overview', this.margin, this.currentY);
    this.currentY += 10;

    // Create shift pattern table
    autoTable(this.doc, {
      startY: this.currentY,
      head: [['Shift Code', 'Name', 'Start Time', 'End Time', 'Hours', 'Break (min)']],
      body: shiftData.map((shift) => [
        shift.code,
        shift.name,
        shift.startTime,
        shift.endTime,
        shift.hours.toString(),
        shift.breakMinutes.toString(),
      ]),
      theme: 'striped',
      headStyles: {
        fillColor: [103, 58, 183],
        textColor: 255,
        fontSize: 10,
        fontStyle: 'bold',
      },
      bodyStyles: {
        fontSize: 9,
      },
      margin: { left: this.margin, right: this.margin },
    });

    this.addFooter();
    return this.doc.output('arraybuffer') as Uint8Array;
  }

  /**
   * Add page numbers and footer
   */
  private addFooter(): void {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(128, 128, 128);

      // Page number
      this.doc.text(
        `Page ${i} of ${pageCount}`,
        this.pageWidth / 2,
        this.pageHeight - 10,
        { align: 'center' }
      );

      // Footer text
      this.doc.text(
        'Generated by ShiftEasy',
        this.margin,
        this.pageHeight - 10
      );

      this.doc.text(
        new Date().toLocaleString(),
        this.pageWidth - this.margin,
        this.pageHeight - 10,
        { align: 'right' }
      );
    }
  }

  /**
   * Save PDF to file
   */
  save(filename: string): void {
    this.doc.save(filename);
  }

  /**
   * Get PDF as blob
   */
  getBlob(): Blob {
    return this.doc.output('blob');
  }

  /**
   * Get PDF as base64
   */
  getBase64(): string {
    return this.doc.output('datauristring');
  }
}

export const createPDFReport = (options: PDFReportOptions) => new PDFReportGenerator(options);