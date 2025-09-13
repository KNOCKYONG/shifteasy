/**
 * Report Generation API
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { excelGenerator } from '@/lib/reports/excel-generator';
import { createPDFReport } from '@/lib/reports/pdf-generator';
import { batchProcessor } from '@/lib/batch/batch-processor';

const reportGenerationSchema = z.object({
  reportType: z.enum(['schedule', 'kpi', 'employee', 'shift_pattern']),
  format: z.enum(['excel', 'pdf', 'both']),
  period: z.object({
    start: z.string(),
    end: z.string(),
  }),
  async: z.boolean().optional(),
  options: z.object({
    includeCharts: z.boolean().optional(),
    includeMetadata: z.boolean().optional(),
    departments: z.array(z.string()).optional(),
  }).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const tenantId = request.headers.get('x-tenant-id') || 'default-tenant';
    const body = await request.json();
    const validatedData = reportGenerationSchema.parse(body);

    // For async processing
    if (validatedData.async) {
      const jobId = await batchProcessor.addJob(
        'generate_report',
        {
          ...validatedData,
          tenantId,
        },
        {
          priority: 'normal',
          metadata: {
            requestedBy: request.headers.get('x-user-id'),
            requestedAt: new Date().toISOString(),
          },
        }
      );

      return NextResponse.json({
        success: true,
        jobId,
        message: 'Report generation queued',
        statusUrl: `/api/batch/status/${jobId}`,
      });
    }

    // Synchronous processing
    const results: any = {};

    // Generate mock data for demonstration
    const mockScheduleData = Array.from({ length: 20 }, (_, i) => ({
      date: new Date(2024, 0, i + 1),
      employeeName: `Employee ${i + 1}`,
      employeeId: `EMP${String(i + 1).padStart(3, '0')}`,
      shift: ['Morning', 'Afternoon', 'Night'][i % 3],
      hours: 8 + (i % 3),
      department: ['Emergency', 'ICU', 'General'][i % 3],
      notes: i % 5 === 0 ? 'Overtime approved' : undefined,
    }));

    const mockKPIData = [
      { metric: 'Staff Utilization', value: 87.5, target: 85, trend: 'up' as const, period: 'Monthly' },
      { metric: 'Overtime Hours', value: 342, target: 300, trend: 'down' as const, period: 'Monthly' },
      { metric: 'Shift Coverage', value: 98.2, target: 99, trend: 'stable' as const, period: 'Monthly' },
      { metric: 'Employee Satisfaction', value: 7.8, target: 8, trend: 'up' as const, period: 'Monthly' },
    ];

    // Generate Excel report
    if (validatedData.format === 'excel' || validatedData.format === 'both') {
      let excelBuffer: Buffer;

      switch (validatedData.reportType) {
        case 'schedule':
          excelBuffer = await excelGenerator.generateScheduleReport(
            mockScheduleData,
            'January',
            2024
          );
          break;

        case 'kpi':
          excelBuffer = await excelGenerator.generateKPIReport(
            mockKPIData,
            'January 2024'
          );
          break;

        case 'employee':
          const mockEmployeeData = Array.from({ length: 15 }, (_, i) => ({
            id: `EMP${String(i + 1).padStart(3, '0')}`,
            name: `Employee ${i + 1}`,
            department: ['Emergency', 'ICU', 'General'][i % 3],
            totalHours: 160 + Math.floor(Math.random() * 20),
            overtimeHours: Math.floor(Math.random() * 30),
            shiftsWorked: 20 + Math.floor(Math.random() * 5),
            attendance: 85 + Math.random() * 15,
          }));

          excelBuffer = await excelGenerator.generateEmployeeSummary(
            mockEmployeeData,
            'January 2024'
          );
          break;

        default:
          excelBuffer = Buffer.from('');
      }

      results.excel = {
        size: excelBuffer.length,
        data: excelBuffer.toString('base64'),
        filename: `${validatedData.reportType}_${Date.now()}.xlsx`,
      };

      excelGenerator.reset();
    }

    // Generate PDF report
    if (validatedData.format === 'pdf' || validatedData.format === 'both') {
      const pdfGenerator = createPDFReport({
        title: `${validatedData.reportType.charAt(0).toUpperCase() + validatedData.reportType.slice(1)} Report`,
        subtitle: `Period: ${validatedData.period.start} to ${validatedData.period.end}`,
        date: new Date(),
      });

      let pdfData: Uint8Array;

      switch (validatedData.reportType) {
        case 'schedule':
          pdfData = pdfGenerator.generateSchedulePDF(mockScheduleData);
          break;

        case 'kpi':
          pdfData = pdfGenerator.generateKPIPDF(mockKPIData);
          break;

        case 'employee':
          const mockEmployeeData = Array.from({ length: 15 }, (_, i) => ({
            id: `EMP${String(i + 1).padStart(3, '0')}`,
            name: `Employee ${i + 1}`,
            department: ['Emergency', 'ICU', 'General'][i % 3],
            totalHours: 160 + Math.floor(Math.random() * 20),
            overtimeHours: Math.floor(Math.random() * 30),
            shiftsWorked: 20 + Math.floor(Math.random() * 5),
            attendance: 85 + Math.random() * 15,
          }));

          pdfData = pdfGenerator.generateEmployeeSummaryPDF(mockEmployeeData);
          break;

        case 'shift_pattern':
          const mockShiftData = [
            { code: 'M', name: 'Morning', startTime: '07:00', endTime: '15:00', hours: 8, breakMinutes: 30 },
            { code: 'A', name: 'Afternoon', startTime: '15:00', endTime: '23:00', hours: 8, breakMinutes: 30 },
            { code: 'N', name: 'Night', startTime: '23:00', endTime: '07:00', hours: 8, breakMinutes: 30 },
            { code: 'D', name: 'Day', startTime: '08:00', endTime: '17:00', hours: 9, breakMinutes: 60 },
          ];

          pdfData = pdfGenerator.generateShiftPatternPDF(mockShiftData);
          break;

        default:
          pdfData = new Uint8Array();
      }

      results.pdf = {
        size: pdfData.length,
        data: Buffer.from(pdfData).toString('base64'),
        filename: `${validatedData.reportType}_${Date.now()}.pdf`,
      };
    }

    return NextResponse.json({
      success: true,
      reports: results,
      generatedAt: new Date().toISOString(),
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }

    console.error('Report generation error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to generate report',
      },
      { status: 500 }
    );
  }
}