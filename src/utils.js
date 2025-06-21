// Utility functions for Concert Moments Platform

export const formatFileSize = (bytes) => {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

export const formatDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  // Handle DD-MM-YYYY format (common in setlist.fm)
  if (dateString.includes('-')) {
    const parts = dateString.split('-');
    if (parts.length === 3) {
      const day = parseInt(parts[0]);
      const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
      const year = parseInt(parts[2]);
      
      if (year >= 2020 && year <= 2025 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
  }
  
  // Fallback: try parsing as regular date
  try {
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    }
  } catch (err) {
    // Return original if parsing fails
  }
  
  return dateString;
};

export const formatShortDate = (dateString) => {
  if (!dateString) return 'Unknown date';
  
  try {
    // Handle DD-MM-YYYY format
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: year === new Date().getFullYear() ? undefined : 'numeric'
        });
      }
    }
    
    // Fallback
    const date = new Date(dateString);
    if (!isNaN(date.getTime())) {
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    }
  } catch (err) {
    // Return original if parsing fails
  }
  
  return dateString;
};

// Featured Artists with official setlist.fm IDs
export const FEATURED_ARTISTS = [
  { name: 'Unknown Mortal Orchestra', mbid: '33d2ccc9' },
  { name: 'Fontaines D.C.', mbid: '2bcac0f6' },
  { name: 'Green Day', mbid: '13d68939' },
  { name: 'Tyler, The Creator', mbid: '73d2e2cd' },
  { name: 'SiR', mbid: '63c7ca07' },
  { name: 'Fatboy Slim', mbid: '33d6b0ad' },
  { name: 'Daniel Me Estas Matando', mbid: '63f31a0f' },
  { name: 'Ca7riel y Paco Amoroso', mbid: '5bf6136c' }
];