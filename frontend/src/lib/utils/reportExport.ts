import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import {
  type ReportFilters,
  generatePerformanceReport,
  generateTaskDurationReport,
  generateWorkloadReport,
  generateTrendsReport,
  generateActivityReport,
} from '../api/reports';

type TabId = 'performance' | 'tasks' | 'workload' | 'trends' | 'activity';

// Helper to trigger file download
function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Escape CSV value
function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// Convert array of objects to CSV string
function arrayToCSV(data: Record<string, unknown>[], columns: { key: string; label: string }[]): string {
  const header = columns.map(c => escapeCSV(c.label)).join(',');
  const rows = data.map(row =>
    columns.map(c => escapeCSV(row[c.key] as string | number | null)).join(',')
  );
  return [header, ...rows].join('\n');
}

// Format date for filename
function formatDateForFilename(date: Date): string {
  return date.toISOString().split('T')[0];
}

// Export Performance Report to CSV
async function exportPerformanceCSV(filters: ReportFilters): Promise<void> {
  const report = await generatePerformanceReport(filters);

  const columns = [
    { key: 'userName', label: 'User' },
    { key: 'userEmail', label: 'Email' },
    { key: 'cardsCompleted', label: 'Cards Completed' },
    { key: 'cardsAssigned', label: 'Cards Assigned' },
    { key: 'cardsCreated', label: 'Cards Created' },
    { key: 'completionRate', label: 'Completion Rate (%)' },
    { key: 'avgCompletionTimeHours', label: 'Avg Completion Time (hrs)' },
    { key: 'overdueCards', label: 'Overdue Cards' },
    { key: 'approvedCards', label: 'Cards Approved' },
    { key: 'rejectedCards', label: 'Cards Rejected' },
    { key: 'onTimeCompletions', label: 'On-Time Completions' },
    { key: 'lateCompletions', label: 'Late Completions' },
  ];

  const csv = arrayToCSV(report.users as unknown as Record<string, unknown>[], columns);
  const filename = `performance-report-${formatDateForFilename(report.dateRange.start)}-to-${formatDateForFilename(report.dateRange.end)}.csv`;
  downloadFile(csv, filename, 'text/csv');
}

// Export Tasks Report to CSV
async function exportTasksCSV(filters: ReportFilters): Promise<void> {
  const report = await generateTaskDurationReport(filters);

  // Duration buckets
  const durationColumns = [
    { key: 'label', label: 'Duration' },
    { key: 'count', label: 'Tasks' },
    { key: 'percentage', label: 'Percentage' },
  ];

  const durationCSV = arrayToCSV(report.cardsByDuration as unknown as Record<string, unknown>[], durationColumns);

  // Overdue by user
  const overdueColumns = [
    { key: 'userName', label: 'User' },
    { key: 'count', label: 'Overdue Tasks' },
  ];

  const overdueCSV = report.overdueAnalysis.overdueByUser.length > 0
    ? '\n\nOverdue by User\n' + arrayToCSV(report.overdueAnalysis.overdueByUser as unknown as Record<string, unknown>[], overdueColumns)
    : '';

  // Summary
  const summary = `Task Duration Report
Date Range: ${formatDateForFilename(report.dateRange.start)} to ${formatDateForFilename(report.dateRange.end)}

Average Creation to Completion: ${report.avgCreationToCompletionHours ?? 'N/A'} hours
Average Approval to Completion: ${report.avgApprovalToCompletionHours ?? 'N/A'} hours
Median Completion Time: ${report.medianCompletionTimeHours ?? 'N/A'} hours
Total Overdue: ${report.overdueAnalysis.totalOverdue}

Duration Distribution
${durationCSV}${overdueCSV}`;

  const filename = `tasks-report-${formatDateForFilename(report.dateRange.start)}-to-${formatDateForFilename(report.dateRange.end)}.csv`;
  downloadFile(summary, filename, 'text/csv');
}

// Export Workload Report to CSV
async function exportWorkloadCSV(filters: ReportFilters): Promise<void> {
  const report = await generateWorkloadReport(filters);

  const columns = [
    { key: 'userName', label: 'User' },
    { key: 'userEmail', label: 'Email' },
    { key: 'openCards', label: 'Open Cards' },
    { key: 'completedCards', label: 'Completed Cards' },
    { key: 'overdueCards', label: 'Overdue Cards' },
    { key: 'rejectedCards', label: 'Rejected Cards' },
    { key: 'cardsCreatedThisPeriod', label: 'Cards Created' },
    { key: 'workloadScore', label: 'Workload Score' },
  ];

  const csv = arrayToCSV(report.users as unknown as Record<string, unknown>[], columns);

  const summary = `Workload Report
Date Range: ${formatDateForFilename(report.dateRange.start)} to ${formatDateForFilename(report.dateRange.end)}

Total Open Cards: ${report.distribution.totalOpenCards}
Average Cards Per User: ${report.distribution.avgCardsPerUser}
Balance Index: ${report.distribution.balanceIndex}%

User Workload
${csv}`;

  const filename = `workload-report-${formatDateForFilename(report.dateRange.start)}-to-${formatDateForFilename(report.dateRange.end)}.csv`;
  downloadFile(summary, filename, 'text/csv');
}

// Export Trends Report to CSV
async function exportTrendsCSV(filters: ReportFilters): Promise<void> {
  const report = await generateTrendsReport(filters);

  // Combine all data
  const combinedData = report.cardsCompletedOverTime.map((item, index) => ({
    date: item.date,
    completed: item.value,
    created: report.cardsCreatedOverTime[index]?.value || 0,
    velocity: report.completionVelocity[index]?.value || 0,
    overdue: report.overdueOverTime[index]?.value || 0,
  }));

  const columns = [
    { key: 'date', label: 'Date' },
    { key: 'created', label: 'Cards Created' },
    { key: 'completed', label: 'Cards Completed' },
    { key: 'velocity', label: 'Velocity (Rolling Avg)' },
    { key: 'overdue', label: 'Overdue' },
  ];

  const csv = arrayToCSV(combinedData as unknown as Record<string, unknown>[], columns);

  const summary = `Trends Report (${report.granularity})
Date Range: ${formatDateForFilename(report.dateRange.start)} to ${formatDateForFilename(report.dateRange.end)}

${csv}`;

  const filename = `trends-report-${formatDateForFilename(report.dateRange.start)}-to-${formatDateForFilename(report.dateRange.end)}.csv`;
  downloadFile(summary, filename, 'text/csv');
}

// Export Activity Report to CSV
async function exportActivityCSV(filters: ReportFilters): Promise<void> {
  const report = await generateActivityReport(filters);

  // Activity by type
  const typeColumns = [
    { key: 'label', label: 'Activity Type' },
    { key: 'count', label: 'Count' },
  ];

  const typeCSV = arrayToCSV(report.summary.activitiesByType as unknown as Record<string, unknown>[], typeColumns);

  // Activity by user
  const userColumns = [
    { key: 'userName', label: 'User' },
    { key: 'count', label: 'Activities' },
  ];

  const userCSV = arrayToCSV(report.summary.activitiesByUser as unknown as Record<string, unknown>[], userColumns);

  // Recent activities
  const activityColumns = [
    { key: 'authorName', label: 'User' },
    { key: 'type', label: 'Type' },
    { key: 'description', label: 'Description' },
    { key: 'createdAt', label: 'Date' },
  ];

  const activityCSV = arrayToCSV(report.recentActivities as unknown as Record<string, unknown>[], activityColumns);

  const summary = `Activity Report
Date Range: ${formatDateForFilename(report.dateRange.start)} to ${formatDateForFilename(report.dateRange.end)}

Total Activities: ${report.summary.totalActivities}

Activities by Type
${typeCSV}

Activities by User
${userCSV}

Recent Activities
${activityCSV}`;

  const filename = `activity-report-${formatDateForFilename(report.dateRange.start)}-to-${formatDateForFilename(report.dateRange.end)}.csv`;
  downloadFile(summary, filename, 'text/csv');
}

// Main CSV export function
export async function exportToCSV(tabId: TabId, filters: ReportFilters): Promise<void> {
  switch (tabId) {
    case 'performance':
      return exportPerformanceCSV(filters);
    case 'tasks':
      return exportTasksCSV(filters);
    case 'workload':
      return exportWorkloadCSV(filters);
    case 'trends':
      return exportTrendsCSV(filters);
    case 'activity':
      return exportActivityCSV(filters);
    default:
      throw new Error(`Unknown tab: ${tabId}`);
  }
}

// Helper function to convert oklch colors to rgb in a cloned document
function convertOklchToRgb(doc: Document): void {
  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    const element = el as HTMLElement;
    const computedStyle = window.getComputedStyle(element);

    // Get computed colors (already converted to rgb by browser)
    const bgColor = computedStyle.backgroundColor;
    const textColor = computedStyle.color;
    const borderColor = computedStyle.borderColor;

    // Apply the computed (rgb) values directly to inline styles
    if (bgColor && bgColor !== 'rgba(0, 0, 0, 0)') {
      element.style.backgroundColor = bgColor;
    }
    if (textColor) {
      element.style.color = textColor;
    }
    if (borderColor && borderColor !== 'rgba(0, 0, 0, 0)') {
      element.style.borderColor = borderColor;
    }
  });
}

// Generate text-based PDF as fallback when html2canvas fails
async function generateTextBasedPDF(tabId: TabId, filters: ReportFilters): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 15;
  let yPosition = margin;

  const addText = (text: string, fontSize: number = 10, isBold: boolean = false) => {
    pdf.setFontSize(fontSize);
    pdf.setFont('helvetica', isBold ? 'bold' : 'normal');

    // Handle text wrapping
    const maxWidth = pageWidth - (margin * 2);
    const lines = pdf.splitTextToSize(text, maxWidth);

    lines.forEach((line: string) => {
      if (yPosition > pageHeight - margin) {
        pdf.addPage();
        yPosition = margin;
      }
      pdf.text(line, margin, yPosition);
      yPosition += fontSize * 0.5;
    });
  };

  const addSpace = (space: number = 5) => {
    yPosition += space;
    if (yPosition > pageHeight - margin) {
      pdf.addPage();
      yPosition = margin;
    }
  };

  // Title
  addText(`${tabId.charAt(0).toUpperCase() + tabId.slice(1)} Report`, 18, true);
  addSpace(3);

  // Date range
  pdf.setTextColor(100, 100, 100);
  addText(`${filters.dateRange.start.toLocaleDateString()} - ${filters.dateRange.end.toLocaleDateString()}`, 10);
  addSpace(2);
  addText(`Generated: ${new Date().toLocaleString()}`, 8);
  pdf.setTextColor(0, 0, 0);
  addSpace(10);

  // Fetch and add report data based on tab
  try {
    switch (tabId) {
      case 'performance': {
        const report = await generatePerformanceReport(filters);
        addText('User Performance Summary', 14, true);
        addSpace(5);
        report.users.forEach((user) => {
          addText(`${user.userName}`, 11, true);
          addText(`  Completed: ${user.cardsCompleted} | Assigned: ${user.cardsAssigned} | Rate: ${user.completionRate}%`);
          addText(`  Avg Time: ${user.avgCompletionTimeHours?.toFixed(1) ?? 'N/A'}h | Overdue: ${user.overdueCards}`);
          addSpace(3);
        });
        break;
      }
      case 'tasks': {
        const report = await generateTaskDurationReport(filters);
        addText('Task Duration Summary', 14, true);
        addSpace(5);
        addText(`Average Completion Time: ${report.avgCreationToCompletionHours?.toFixed(1) ?? 'N/A'} hours`);
        addText(`Median Completion Time: ${report.medianCompletionTimeHours?.toFixed(1) ?? 'N/A'} hours`);
        addText(`Currently Overdue: ${report.overdueAnalysis.totalOverdue}`);
        addSpace(5);
        addText('Duration Distribution:', 12, true);
        addSpace(3);
        report.cardsByDuration.forEach((bucket) => {
          addText(`  ${bucket.label}: ${bucket.count} tasks (${bucket.percentage}%)`);
        });
        break;
      }
      case 'workload': {
        const report = await generateWorkloadReport(filters);
        addText('Workload Distribution', 14, true);
        addSpace(5);
        addText(`Total Open Cards: ${report.distribution.totalOpenCards}`);
        addText(`Average per User: ${report.distribution.avgCardsPerUser}`);
        addText(`Balance Index: ${report.distribution.balanceIndex}%`);
        addSpace(5);
        addText('User Workload:', 12, true);
        addSpace(3);
        report.users.forEach((user) => {
          addText(`${user.userName}: ${user.openCards} open, ${user.completedCards} completed, ${user.overdueCards} overdue`);
        });
        break;
      }
      case 'trends': {
        const report = await generateTrendsReport(filters);
        addText('Productivity Trends', 14, true);
        addSpace(5);
        addText('Weekly Summary:', 12, true);
        addSpace(3);
        report.cardsCompletedOverTime.forEach((item, i) => {
          const created = report.cardsCreatedOverTime[i]?.value ?? 0;
          const velocity = report.completionVelocity[i]?.value ?? 0;
          addText(`${item.date}: Created ${created}, Completed ${item.value}, Velocity ${velocity.toFixed(1)}`);
        });
        break;
      }
      case 'activity': {
        const report = await generateActivityReport(filters);
        addText('Activity Summary', 14, true);
        addSpace(5);
        addText(`Total Activities: ${report.summary.totalActivities}`);
        addSpace(5);
        addText('By Type:', 12, true);
        addSpace(3);
        report.summary.activitiesByType.forEach((type) => {
          addText(`  ${type.label}: ${type.count}`);
        });
        addSpace(5);
        addText('By User:', 12, true);
        addSpace(3);
        report.summary.activitiesByUser.slice(0, 10).forEach((user) => {
          addText(`  ${user.userName}: ${user.count} activities`);
        });
        break;
      }
    }
  } catch (err) {
    addText('Error loading report data', 12);
    console.error('Error generating PDF content:', err);
  }

  // Add footer to all pages
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(8);
    pdf.setTextColor(128, 128, 128);
    pdf.text(
      `Page ${i} of ${totalPages} | BoxTasks Reports`,
      pageWidth / 2,
      pageHeight - 5,
      { align: 'center' }
    );
  }

  // Download
  const filename = `${tabId}-report-${formatDateForFilename(filters.dateRange.start)}-to-${formatDateForFilename(filters.dateRange.end)}.pdf`;
  pdf.save(filename);
}

// Export current view to PDF using html2canvas (with fallback)
export async function exportToPDF(tabId: TabId, filters: ReportFilters): Promise<void> {
  // Find the report content element
  const contentElement = document.querySelector('.min-h-\\[400px\\]') as HTMLElement;

  if (!contentElement) {
    // Fall back to text-based PDF
    return generateTextBasedPDF(tabId, filters);
  }

  // Create PDF
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 10;

  // Add header
  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  const title = `${tabId.charAt(0).toUpperCase() + tabId.slice(1)} Report`;
  pdf.text(title, margin, margin + 10);

  // Add date range
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  const dateRangeText = `${filters.dateRange.start.toLocaleDateString()} - ${filters.dateRange.end.toLocaleDateString()}`;
  pdf.text(dateRangeText, margin, margin + 18);

  // Add generated date
  pdf.setFontSize(8);
  pdf.setTextColor(128, 128, 128);
  pdf.text(`Generated: ${new Date().toLocaleString()}`, margin, margin + 24);
  pdf.setTextColor(0, 0, 0);

  // Capture content as canvas
  try {
    const canvas = await html2canvas(contentElement, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: contentElement.scrollWidth,
      windowHeight: contentElement.scrollHeight,
      onclone: (doc) => {
        // Convert oklch colors to rgb before capturing
        convertOklchToRgb(doc);
      },
    });

    // Calculate dimensions to fit on page
    const imgWidth = pageWidth - (margin * 2);
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const startY = margin + 30;

    // Add image to PDF
    const imgData = canvas.toDataURL('image/png');

    // If content is too tall, split across pages
    if (imgHeight > pageHeight - startY - margin) {
      let remainingHeight = imgHeight;
      let currentPosition = 0;

      while (remainingHeight > 0) {
        const pageContentHeight = currentPosition === 0
          ? pageHeight - startY - margin
          : pageHeight - (margin * 2);

        // Calculate how much of the image to show on this page
        const sourceY = (currentPosition / imgHeight) * canvas.height;
        const sourceHeight = (pageContentHeight / imgHeight) * canvas.height;

        // Create a temporary canvas for this page segment
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width;
        tempCanvas.height = sourceHeight;
        const tempCtx = tempCanvas.getContext('2d');

        if (tempCtx) {
          tempCtx.drawImage(
            canvas,
            0, sourceY, canvas.width, sourceHeight,
            0, 0, canvas.width, sourceHeight
          );

          const pageImgData = tempCanvas.toDataURL('image/png');
          const yPosition = currentPosition === 0 ? startY : margin;

          pdf.addImage(
            pageImgData,
            'PNG',
            margin,
            yPosition,
            imgWidth,
            Math.min(pageContentHeight, remainingHeight)
          );
        }

        currentPosition += pageContentHeight;
        remainingHeight -= pageContentHeight;

        if (remainingHeight > 0) {
          pdf.addPage();
        }
      }
    } else {
      pdf.addImage(imgData, 'PNG', margin, startY, imgWidth, imgHeight);
    }

    // Add footer
    const totalPages = pdf.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      pdf.setPage(i);
      pdf.setFontSize(8);
      pdf.setTextColor(128, 128, 128);
      pdf.text(
        `Page ${i} of ${totalPages} | BoxTasks Reports`,
        pageWidth / 2,
        pageHeight - 5,
        { align: 'center' }
      );
    }

    // Download
    const filename = `${tabId}-report-${formatDateForFilename(filters.dateRange.start)}-to-${formatDateForFilename(filters.dateRange.end)}.pdf`;
    pdf.save(filename);
  } catch (error) {
    console.error('Failed to generate PDF with html2canvas, falling back to text-based PDF:', error);
    // Fall back to text-based PDF generation
    return generateTextBasedPDF(tabId, filters);
  }
}
