/**
 * CSV Export utility for SMARTRETURN AI
 * Ensures standard RFC 4180 CSV generation with UTF-8 BOM for Excel compatibility.
 */

export const exportToCSV = (filename, data, columns) => {
  if (!Array.isArray(data) || data.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Escape helper for CSV cells
  const escapeCell = (val) => {
    if (val === null || val === undefined) return '""';
    const str = String(val).replace(/"/g, '""');
    return `"${str}"`;
  };

  // Header row
  const headerRow = columns.map((col) => escapeCell(col.header)).join(',');

  // Data rows
  const dataRows = data.map((item) => {
    return columns
      .map((col) => {
        let value;
        if (typeof col.accessor === 'function') {
          value = col.accessor(item);
        } else {
          value = item[col.accessor];
        }
        return escapeCell(value);
      })
      .join(',');
  });

  // UTF-8 BOM prefix (\uFEFF) ensures Excel correctly displays UTF-8 characters (currencies, accents)
  const csvContent = '\uFEFF' + [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.setAttribute('href', url);
  const cleanFilename = filename.endsWith('.csv') ? filename : `${filename}.csv`;
  link.setAttribute('download', cleanFilename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
