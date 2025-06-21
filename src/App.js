import React, { useEffect, useState, createContext, useContext } from 'react';

// Authentication Context
const AuthContext = createContext();

const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const userData = localStorage.getItem('user');
    if (token && userData) {
      setUser(JSON.parse(userData));
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      const response = await fetch('http://localhost:5050/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Login failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const register = async (email, password, displayName) => {
    try {
      const response = await fetch('http://localhost:5050/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, displayName }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Registration failed');
      }

      const data = await response.json();
      localStorage.setItem('token', data.token);
      localStorage.setItem('user', JSON.stringify(data.user));
      setUser(data.user);
      return data;
    } catch (error) {
      throw error;
    }
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

// Artist Search Component
const ArtistSearch = ({ onArtistSelect, currentArtist }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const searchArtists = async (query) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      console.log('🔍 Searching for artist:', query);
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/search/artists?artistName=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        console.log('📊 Search results:', data);
        
        // Filter and sort results - exact matches first, then partial matches
        const artists = data.artist || [];
        const filteredArtists = artists
          .filter(artist => artist.name && artist.mbid) // Must have name and ID
          .sort((a, b) => {
            // Exact match gets priority
            const aExact = a.name.toLowerCase() === query.toLowerCase();
            const bExact = b.name.toLowerCase() === query.toLowerCase();
            if (aExact && !bExact) return -1;
            if (bExact && !aExact) return 1;
            // Then by name length (shorter = more likely to be main artist)
            return a.name.length - b.name.length;
          });
        
        setSearchResults(filteredArtists);
        setShowResults(true);
      } else {
        console.error('Search API error:', response.status);
      }
    } catch (err) {
      console.error('Artist search error:', err);
    } finally {
      setSearching(false);
    }
  };

  // Fix debounce logic
  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    // Clear previous timeout
    if (window.searchTimeout) {
      clearTimeout(window.searchTimeout);
    }
    
    // Debounce search
    window.searchTimeout = setTimeout(() => {
      searchArtists(query);
    }, 500);
  };

  const selectArtist = (artist) => {
    onArtistSelect(artist);
    setSearchQuery('');
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="relative max-w-md mx-auto">
      <div className="relative">
        <input
          type="text"
          value={searchQuery}
          onChange={handleSearch}
          placeholder="Search for any artist..."
          className="w-full px-4 py-3 text-lg border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        />
        {searching && (
          <div className="absolute right-3 top-3">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          </div>
        )}
      </div>

      {/* Search Results Dropdown */}
      {showResults && searchResults.length > 0 && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {searchResults.slice(0, 10).map((artist) => (
            <button
              key={artist.mbid}
              onClick={() => selectArtist(artist)}
              className="w-full px-4 py-3 text-left hover:bg-gray-50 border-b border-gray-100 last:border-b-0"
            >
              <div className="font-medium">{artist.name}</div>
              {artist.disambiguation && (
                <div className="text-sm text-gray-500">{artist.disambiguation}</div>
              )}
            </button>
          ))}
        </div>
      )}

      {/* Current Artist Display */}
      {currentArtist && (
        <div className="mt-4 text-center">
          <div className="inline-flex items-center px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
            <span className="font-medium">Viewing: {currentArtist.name}</span>
            <button
              onClick={() => onArtistSelect(null)}
              className="ml-2 text-blue-600 hover:text-blue-800"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Featured Artists Component
const FeaturedArtists = ({ onArtistSelect }) => {
  const [featuredArtists, setFeaturedArtists] = useState([]);
  const [loading, setLoading] = useState(true);

  // Prioritize the artists that work best - UMO first, then the ones mentioned
  const artistNames = [
    'Unknown Mortal Orchestra',  // This works - put first
    'Fontaines D.C.',           // This works - put second  
    'Green Day',                // Popular, should work
    'Tyler, The Creator',       // Popular, should work
    'SiR',
    'Fatboy Slim',
    'Daniel Me Estas Matando', 
    'Ca7riel y Paco Amoroso'
  ];

  // Simplified validation - just check if artist has ANY setlists
  const validateArtist = async (artist) => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000); // 3 second timeout
      
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/artist/${artist.mbid}/setlists?p=1`,
        { 
          headers: { Accept: 'application/json' },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const setlists = data.setlist || [];
        
        // Simplified validation - just need ANY setlists
        const hasSetlists = setlists.length > 0;
        console.log(`🎵 ${artist.name}: ${setlists.length} setlists (${hasSetlists ? 'VALID' : 'SKIP'})`);
        return hasSetlists;
      }
      return false;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`⏰ ${artist.name}: validation timeout`);
      } else {
        console.error(`❌ Validation error for ${artist.name}:`, err);
      }
      return false;
    }
  };

  // Find best artist match with timeout
  const findBestArtist = async (artistName) => {
    try {
      console.log(`🔍 Searching for: ${artistName}`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout
      
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/search/artists?artistName=${encodeURIComponent(artistName)}`,
        { 
          headers: { Accept: 'application/json' },
          signal: controller.signal
        }
      );
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        const artists = data.artist || [];
        
        // Find exact match first
        let bestMatch = artists.find(artist => 
          artist.name.toLowerCase() === artistName.toLowerCase()
        );
        
        // If no exact match, find closest match (no collaborations)
        if (!bestMatch) {
          bestMatch = artists
            .filter(artist => 
              !artist.name.toLowerCase().includes('feat') &&
              !artist.name.toLowerCase().includes('featuring') &&
              !artist.name.toLowerCase().includes(' & ') &&
              !artist.name.toLowerCase().includes(' and ') &&
              !artist.name.toLowerCase().includes(' x ')
            )
            .sort((a, b) => a.name.length - b.name.length)[0];
        }
        
        if (bestMatch) {
          console.log(`✅ Found match: ${bestMatch.name}`);
          return bestMatch;
        }
      }
      return null;
    } catch (err) {
      if (err.name === 'AbortError') {
        console.log(`⏰ ${artistName}: search timeout`);
      } else {
        console.error(`❌ Error fetching ${artistName}:`, err);
      }
      return null;
    }
  };

  useEffect(() => {
    const fetchFeaturedArtists = async () => {
      console.log('🎯 Fetching featured artists (prioritized)...');
      const validArtists = [];
      
      // Process artists in parallel but with staggered delays
      const artistPromises = artistNames.map(async (artistName, index) => {
        // Stagger requests to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, index * 300));
        
        try {
          const artist = await findBestArtist(artistName);
          if (artist) {
            // For now, skip validation to speed up loading - just trust the search
            console.log(`✅ Adding ${artist.name} without validation (faster loading)`);
            return { artist, index };
          }
        } catch (err) {
          console.error(`Failed to process ${artistName}:`, err);
        }
        return null;
      });

      // Wait for all promises and filter valid results
      const results = await Promise.all(artistPromises);
      const validResults = results
        .filter(result => result !== null)
        .sort((a, b) => a.index - b.index) // Maintain order
        .map(result => result.artist)
        .slice(0, 6); // Show max 6 featured artists for faster loading

      console.log(`✅ Featured artists loaded: ${validResults.map(a => a.name).join(', ')}`);
      setFeaturedArtists(validResults);
      setLoading(false);
    };

    fetchFeaturedArtists();
  }, []);

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-center mb-6">Featured Artists</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="p-4 bg-gray-100 rounded-lg shadow-sm animate-pulse">
              <div className="h-4 bg-gray-300 rounded w-3/4 mx-auto"></div>
            </div>
          ))}
        </div>
        <div className="text-center mt-4 text-sm text-gray-500">
          Loading featured artists...
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-center mb-6">Featured Artists</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {featuredArtists.map((artist) => (
          <button
            key={artist.mbid}
            onClick={() => onArtistSelect(artist)}
            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 hover:border-blue-300"
          >
            <div className="text-sm font-medium text-center text-gray-900 leading-tight">
              {artist.name}
            </div>
          </button>
        ))}
      </div>
      {featuredArtists.length < 6 && (
        <div className="text-center mt-4 text-sm text-gray-500">
          Found {featuredArtists.length} featured artists
        </div>
      )}
    </div>
  );
};

// Recent Concerts Component
const RecentConcerts = ({ onConcertSelect }) => {
  const [recentConcerts, setRecentConcerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentConcerts = async () => {
      try {
        console.log('🎪 Fetching recent concerts (2025)...');
        
        // Try multiple approaches to get recent setlists (prioritizing 2025)
        const approaches = [
          // Approach 1: Get 2025 setlists first
          () => fetch(
            `http://localhost:5050/api/rest/1.0/search/setlists?year=2025&p=1`,
            { headers: { Accept: 'application/json' } }
          ),
          // Approach 2: Get late 2024 setlists
          () => fetch(
            `http://localhost:5050/api/rest/1.0/search/setlists?year=2024&p=1`,
            { headers: { Accept: 'application/json' } }
          ),
          // Approach 3: Get recent setlists without year filter (should be most recent)
          () => fetch(
            `http://localhost:5050/api/rest/1.0/search/setlists?p=1`,
            { headers: { Accept: 'application/json' } }
          ),
          // Approach 4: Get setlists from major cities (recent activity)
          () => fetch(
            `http://localhost:5050/api/rest/1.0/search/setlists?cityName=Los%20Angeles&p=1`,
            { headers: { Accept: 'application/json' } }
          ),
          () => fetch(
            `http://localhost:5050/api/rest/1.0/search/setlists?cityName=London&p=1`,
            { headers: { Accept: 'application/json' } }
          )
        ];

        let concerts = [];
        
        for (const approach of approaches) {
          try {
            const response = await approach();
            if (response.ok) {
              const data = await response.json();
              if (data.setlist && data.setlist.length > 0) {
                concerts = data.setlist;
                console.log(`✅ Found ${concerts.length} concerts`);
                break;
              }
            }
          } catch (err) {
            console.log('❌ Approach failed, trying next...');
            continue;
          }
        }

        // If still no concerts, try getting from featured artists (most active ones)
        if (concerts.length === 0) {
          console.log('🎯 Fallback: Getting recent concerts from active artists...');
          const activeArtists = [
            '4f4ec0c9-091e-4f39-b964-7ffd2b01ecef', // Green Day 
            'e2305342-0bde-4a2c-aed0-4b88694834de', // Unknown Mortal Orchestra
            'b95ce3ff-3d05-4e87-9e01-c97b66af13d4'  // Eminem (very active)
          ];
          
          for (const artistId of activeArtists) {
            try {
              const response = await fetch(
                `http://localhost:5050/api/rest/1.0/artist/${artistId}/setlists?p=1`,
                { headers: { Accept: 'application/json' } }
              );
              
              if (response.ok) {
                const data = await response.json();
                if (data.setlist && data.setlist.length > 0) {
                  concerts = data.setlist.slice(0, 8);
                  console.log(`✅ Found ${concerts.length} concerts from active artists`);
                  break;
                }
              }
            } catch (err) {
              console.error('Error fetching from active artist:', err);
            }
          }
        }

        // Filter and sort concerts by recency - ONLY SHOWS WITH ACTUAL SONGS
        const validConcerts = concerts
          .filter(concert => 
            concert.artist?.name && 
            concert.venue?.name && 
            concert.venue?.city?.name &&
            concert.eventDate &&
            // CRITICAL: Only include concerts that have actual songs logged
            concert.sets?.set?.some(set => 
              set.song && Array.isArray(set.song) && set.song.length > 0
            )
          )
          .sort((a, b) => {
            // Parse dates properly (DD-MM-YYYY format)
            const parseDate = (dateStr) => {
              if (!dateStr) return new Date(0);
              const parts = dateStr.split('-');
              if (parts.length === 3) {
                // DD-MM-YYYY format
                return new Date(parseInt(parts[2]), parseInt(parts[1]) - 1, parseInt(parts[0]));
              }
              return new Date(dateStr);
            };
            
            const dateA = parseDate(a.eventDate);
            const dateB = parseDate(b.eventDate);
            
            // Sort by date descending (most recent first)
            return dateB - dateA;
          })
          .slice(0, 10);

        console.log(`📊 Final result: ${validConcerts.length} valid recent concerts WITH SONGS`);
        if (validConcerts.length > 0) {
          console.log(`📅 Date range: ${validConcerts[validConcerts.length-1].eventDate} to ${validConcerts[0].eventDate}`);
          console.log(`🎵 Song counts:`, validConcerts.map(c => ({
            artist: c.artist.name,
            songs: c.sets?.set?.reduce((total, set) => total + (set.song?.length || 0), 0) || 0
          })));
        }
        setRecentConcerts(validConcerts);
        
      } catch (err) {
        console.error('Error fetching recent concerts:', err);
        setRecentConcerts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentConcerts();
  }, []);

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    try {
      // Handle DD-MM-YYYY format (common in setlist.fm)
      if (dateString.includes('-')) {
        const parts = dateString.split('-');
        if (parts.length === 3) {
          const day = parseInt(parts[0]);
          const month = parseInt(parts[1]) - 1; // JS months are 0-indexed
          const year = parseInt(parts[2]);
          
          // Validate the parsed values
          if (year >= 2020 && year <= 2025 && month >= 0 && month <= 11 && day >= 1 && day <= 31) {
            const date = new Date(year, month, day);
            
            return date.toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              year: year === new Date().getFullYear() ? undefined : 'numeric' // Show year only if not current year
            });
          }
        }
      }
      
      // Fallback: try parsing as regular date
      const date = new Date(dateString);
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        });
      }
      
      return dateString; // Return original if parsing fails
    } catch (err) {
      return dateString;
    }
  };

  if (loading) {
    return (
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-center mb-6">Latest Concerts</h2>
        <div className="text-center py-8">
          <div className="text-gray-500">Loading recent concerts...</div>
        </div>
      </div>
    );
  }

  // Don't render anything if no concerts found
  if (recentConcerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-center mb-6">Latest Concerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {recentConcerts.map((concert) => {
          // Calculate total songs in this concert
          const totalSongs = concert.sets?.set?.reduce((total, set) => 
            total + (set.song?.length || 0), 0
          ) || 0;
          
          return (
            <button
              key={concert.id}
              onClick={() => onConcertSelect(concert)}
              className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 hover:border-blue-300 text-left"
            >
              <div className="font-medium text-blue-600 mb-1">{concert.artist.name}</div>
              <div className="text-sm text-gray-600 mb-1">{concert.venue.name}</div>
              <div className="text-sm text-gray-500 mb-2">
                {concert.venue.city.name}, {concert.venue.city.country?.name}
              </div>
              <div className="flex justify-between items-center">
                <div className="text-xs text-gray-400">
                  {formatDate(concert.eventDate)}
                </div>
                <div className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  {totalSongs} songs
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

// Moment Detail Modal (FULL VERSION RESTORED)
const MomentDetailModal = ({ moment, onClose }) => {
  const { user } = useAuth();
  const isOwner = user && moment.user && user.id === moment.user._id;
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState({
    setName: moment.setName || '',
    momentDescription: moment.momentDescription || '',
    emotionalTags: moment.emotionalTags || '',
    momentType: moment.momentType || 'performance',
    specialOccasion: moment.specialOccasion || '',
    instruments: moment.instruments || '',
    audioQuality: moment.audioQuality || 'good',
    videoQuality: moment.videoQuality || 'good',
    crowdReaction: moment.crowdReaction || '',
    guestAppearances: moment.guestAppearances || '',
    personalNote: moment.personalNote || ''
  });
  const [saving, setSaving] = useState(false);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
    
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const handleDownload = () => {
    const link = document.createElement('a');
    link.href = moment.mediaUrl;
    link.download = moment.fileName || 'moment-file';
    link.target = '_blank';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`http://localhost:5050/moments/${moment._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(editedData)
      });

      if (response.ok) {
        setIsEditing(false);
        window.location.reload();
      } else {
        alert('Failed to save changes');
      }
    } catch (err) {
      console.error('Save error:', err);
      alert('Error saving changes');
    } finally {
      setSaving(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: (isOwner && isEditing) ? '#fff' : '#f5f5f5',
    color: (isOwner && isEditing) ? '#000' : '#666'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '600',
    color: '#374151',
    fontSize: '0.875rem'
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #3b82f6',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <div>
              <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
                Moment Details
              </h2>
              <p style={{ color: '#666', fontSize: '1rem' }}>
                {isOwner ? 'Your moment details' : `Moment by ${moment.user?.displayName || 'Anonymous'}`}
              </p>
            </div>
            {isOwner && (
              <button
                onClick={() => setIsEditing(!isEditing)}
                style={{
                  backgroundColor: isEditing ? '#ef4444' : '#3b82f6',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.5rem 1rem',
                  cursor: 'pointer',
                  fontSize: '0.875rem'
                }}
              >
                {isEditing ? 'Cancel Edit' : 'Edit'}
              </button>
            )}
          </div>

          {/* Core Information - Some fields editable for owners */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
              Core Information
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Song Name</label>
                <input
                  type="text"
                  value={moment.songName || ''}
                  readOnly
                  style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Set Name</label>
                <input
                  type="text"
                  value={isEditing ? editedData.setName : (moment.setName || '')}
                  readOnly={!isEditing}
                  onChange={(e) => isEditing && setEditedData({...editedData, setName: e.target.value})}
                  style={inputStyle}
                  placeholder="e.g., Encore, Set 1"
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Venue Name</label>
                <input
                  type="text"
                  value={moment.venueName || ''}
                  readOnly
                  style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Performance Date</label>
                <input
                  type="text"
                  value={moment.performanceDate || ''}
                  readOnly
                  style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                />
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>City</label>
                <input
                  type="text"
                  value={moment.venueCity || ''}
                  readOnly
                  style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Country</label>
                <input
                  type="text"
                  value={moment.venueCountry || ''}
                  readOnly
                  style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                />
              </div>
            </div>
          </div>

          {/* Moment Description - Editable for Owner */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
              Moment Details
            </h3>
            
            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Moment Description</label>
              <textarea
                value={isEditing ? editedData.momentDescription : (moment.momentDescription || '')}
                readOnly={!isEditing}
                onChange={(e) => isEditing && setEditedData({...editedData, momentDescription: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Emotional Tags</label>
                <input
                  type="text"
                  value={isEditing ? editedData.emotionalTags : (moment.emotionalTags || '')}
                  readOnly={!isEditing}
                  onChange={(e) => isEditing && setEditedData({...editedData, emotionalTags: e.target.value})}
                  style={inputStyle}
                  placeholder="energetic, emotional, epic, intimate"
                />
              </div>
              
              <div>
                <label style={labelStyle}>Moment Type</label>
                {isEditing ? (
                  <select
                    value={editedData.momentType}
                    onChange={(e) => setEditedData({...editedData, momentType: e.target.value})}
                    style={inputStyle}
                  >
                    <option value="performance">Performance</option>
                    <option value="crowd">Crowd Reaction</option>
                    <option value="backstage">Backstage</option>
                    <option value="arrival">Band Arrival</option>
                    <option value="interaction">Artist-Fan Interaction</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={moment.momentType || ''}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                  />
                )}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
              <div>
                <label style={labelStyle}>Special Occasion</label>
                <input
                  type="text"
                  value={isEditing ? editedData.specialOccasion : (moment.specialOccasion || '')}
                  readOnly={!isEditing}
                  onChange={(e) => isEditing && setEditedData({...editedData, specialOccasion: e.target.value})}
                  style={inputStyle}
                />
              </div>
              
              <div>
                <label style={labelStyle}>Instruments Featured</label>
                <input
                  type="text"
                  value={isEditing ? editedData.instruments : (moment.instruments || '')}
                  readOnly={!isEditing}
                  onChange={(e) => isEditing && setEditedData({...editedData, instruments: e.target.value})}
                  style={inputStyle}
                />
              </div>
            </div>
          </div>

          {/* Quality & Additional Info - Editable for Owner */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
              Quality & Additional Info
            </h3>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
              <div>
                <label style={labelStyle}>Audio Quality</label>
                {isEditing ? (
                  <select
                    value={editedData.audioQuality}
                    onChange={(e) => setEditedData({...editedData, audioQuality: e.target.value})}
                    style={inputStyle}
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={moment.audioQuality || ''}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                  />
                )}
              </div>
              
              <div>
                <label style={labelStyle}>Video Quality</label>
                {isEditing ? (
                  <select
                    value={editedData.videoQuality}
                    onChange={(e) => setEditedData({...editedData, videoQuality: e.target.value})}
                    style={inputStyle}
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                ) : (
                  <input
                    type="text"
                    value={moment.videoQuality || ''}
                    readOnly
                    style={{ ...inputStyle, backgroundColor: '#f5f5f5' }}
                  />
                )}
              </div>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Crowd Reaction</label>
              <textarea
                value={isEditing ? editedData.crowdReaction : (moment.crowdReaction || '')}
                readOnly={!isEditing}
                onChange={(e) => isEditing && setEditedData({...editedData, crowdReaction: e.target.value})}
                style={{ ...inputStyle, minHeight: '60px' }}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Guest Appearances</label>
              <input
                type="text"
                value={isEditing ? editedData.guestAppearances : (moment.guestAppearances || '')}
                readOnly={!isEditing}
                onChange={(e) => isEditing && setEditedData({...editedData, guestAppearances: e.target.value})}
                style={inputStyle}
              />
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <label style={labelStyle}>Personal Note</label>
              <textarea
                value={isEditing ? editedData.personalNote : (moment.personalNote || '')}
                readOnly={!isEditing}
                onChange={(e) => isEditing && setEditedData({...editedData, personalNote: e.target.value})}
                style={{ ...inputStyle, minHeight: '80px' }}
              />
            </div>
          </div>

          {/* Media File */}
          <div style={{ marginBottom: '1.5rem' }}>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
              Media File
            </h3>
            
            <div style={{
              border: '2px solid #d1d5db',
              borderRadius: '8px',
              padding: '2rem',
              textAlign: 'center',
              backgroundColor: '#f9fafb'
            }}>
              <div>
                <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{moment.fileName}</p>
                <p style={{ color: '#6b7280', marginBottom: '1rem' }}>
                  {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown size'} • {moment.mediaType}
                </p>
                <button
                  onClick={handleDownload}
                  style={{
                    backgroundColor: '#10b981',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    padding: '0.75rem 1.5rem',
                    cursor: 'pointer',
                    fontSize: '1rem',
                    fontWeight: '600'
                  }}
                >
                  Decentralized Storage Link
                </button>
                <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  ⚠️ This will download the file ({moment.fileSize ? formatFileSize(moment.fileSize) : 'unknown size'}) to your computer
                </p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ 
            borderTop: '1px solid #e5e7eb', 
            paddingTop: '1.5rem',
            display: 'flex', 
            gap: '1rem',
            justifyContent: 'flex-end'
          }}>
            <button
              onClick={onClose}
              style={{
                backgroundColor: '#6b7280',
                color: 'white',
                border: 'none',
                borderRadius: '6px',
                padding: '0.75rem 1.5rem',
                cursor: 'pointer',
                fontSize: '1rem'
              }}
            >
              Close
            </button>
            
            {isOwner && isEditing && (
              <button
                onClick={handleSave}
                disabled={saving}
                style={{
                  backgroundColor: saving ? '#9ca3af' : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  cursor: saving ? 'not-allowed' : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Login Component
const Login = () => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();

  const handleSubmit = async () => {
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        await login(email, password);
      } else {
        if (!displayName.trim()) {
          throw new Error('Display name is required');
        }
        await register(email, password, displayName);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-2xl font-bold text-center mb-6">
          {isLogin ? 'Login' : 'Register'}
        </h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
            {error}
          </div>
        )}

        <div className="space-y-4">
          {!isLogin && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Name</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          )}
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          
          <button
            onClick={handleSubmit}
            disabled={loading || !email || !password || (!isLogin && !displayName)}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loading ? 'Processing...' : (isLogin ? 'Login' : 'Register')}
          </button>
        </div>
        
        <div className="text-center mt-4">
          <button
            onClick={() => setIsLogin(!isLogin)}
            className="text-blue-600 hover:text-blue-800 underline"
          >
            {isLogin ? 'Need an account? Register' : 'Have an account? Login'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Detailed Moments Modal (FULL VERSION RESTORED)
const DetailedMomentsModal = ({ songName, performanceId, onClose }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMoment, setSelectedMoment] = useState(null);

  useEffect(() => {
    const fetchMoments = async () => {
      try {
        const response = await fetch('http://localhost:5050/moments');
        if (response.ok) {
          const data = await response.json();
          const filteredMoments = data.moments.filter(
            moment => moment.songName === songName
          );
          setMoments(filteredMoments);
        }
      } catch (err) {
        console.error('Failed to load moments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMoments();
  }, [songName, performanceId]);

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Unknown date';
    
    if (dateString.includes('-')) {
      const parts = dateString.split('-');
      if (parts.length === 3) {
        const day = parseInt(parts[0]);
        const month = parseInt(parts[1]) - 1;
        const year = parseInt(parts[2]);
        const date = new Date(year, month, day);
        
        return date.toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'long',
          day: 'numeric'
        });
      }
    }
    
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const MomentCard = ({ moment }) => (
    <div 
      className="border border-gray-200 rounded-lg p-4 bg-white shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => setSelectedMoment(moment)}
    >
      <div className="flex justify-between items-start mb-3">
        <div className="flex-1">
          <p className="text-sm text-gray-500 mb-1">
            by {moment.user?.displayName || 'Anonymous'}
          </p>
          {moment.momentDescription && (
            <p className="text-gray-900 font-medium mb-2">
              {moment.momentDescription}
            </p>
          )}
        </div>
        <div className="text-right ml-4">
          <span className="inline-block px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
            {moment.mediaType || 'media'}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1 mb-3">
        {moment.emotionalTags && moment.emotionalTags.split(',').map((tag, index) => (
          <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
            {tag.trim()}
          </span>
        ))}
        {moment.specialOccasion && (
          <span className="px-2 py-1 bg-yellow-100 text-yellow-800 text-xs rounded">
            {moment.specialOccasion}
          </span>
        )}
      </div>

      <div className="flex justify-between items-center text-sm text-gray-500">
        <div>
          {moment.audioQuality && moment.audioQuality !== 'good' && (
            <span className="mr-3">Audio: {moment.audioQuality}</span>
          )}
          {moment.videoQuality && moment.videoQuality !== 'good' && (
            <span>Video: {moment.videoQuality}</span>
          )}
        </div>
        <button className="text-blue-600 hover:text-blue-800 font-medium">
          Details →
        </button>
      </div>
    </div>
  );

  const MomentDetailView = ({ moment }) => {
    const [expandedSections, setExpandedSections] = useState({
      performance: true,
      technical: false,
      context: false,
      experience: false
    });

    const toggleSection = (section) => {
      setExpandedSections(prev => ({
        ...prev,
        [section]: !prev[section]
      }));
    };

    const SectionHeader = ({ title, section, count }) => (
      <button
        onClick={() => toggleSection(section)}
        className="w-full flex justify-between items-center p-3 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
      >
        <span className="font-semibold text-gray-900">{title}</span>
        <div className="flex items-center gap-2">
          {count && <span className="text-sm text-gray-600">({count} fields)</span>}
          <span className="text-gray-600">
            {expandedSections[section] ? '−' : '+'}
          </span>
        </div>
      </button>
    );

    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-90vh overflow-auto">
          <div className="p-6">
            <div className="flex justify-between items-start mb-6 border-b border-gray-200 pb-4">
              <div>
                <h3 className="text-2xl font-bold text-gray-900">{moment.songName}</h3>
                <p className="text-lg text-gray-600">
                  {moment.venueName}, {moment.venueCity}
                </p>
                <p className="text-gray-500">
                  {formatDate(moment.performanceDate)} • Uploaded by {moment.user?.displayName || 'Anonymous'}
                </p>
              </div>
              <button
                onClick={() => setSelectedMoment(null)}
                className="text-gray-400 hover:text-gray-600 text-xl font-bold"
              >
                ×
              </button>
            </div>

            <div className="space-y-4">
              {/* Media File - Always Visible */}
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold mb-3 text-blue-900">Media File</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <p><strong>File:</strong> {moment.fileName}</p>
                    <p><strong>Size:</strong> {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown'}</p>
                    <p><strong>Type:</strong> {moment.mediaType}</p>
                  </div>
                  <div>
                    <a 
                      href={moment.mediaUrl} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
                    >
                      Open Media File
                    </a>
                  </div>
                </div>
              </div>

              {/* Venue & Date Details */}
              <div className="space-y-2">
                <SectionHeader 
                  title="Venue & Date" 
                  section="performance"
                  count={[moment.venueName, moment.venueCity, moment.venueCountry, moment.performanceDate].filter(Boolean).length}
                />
                {expandedSections.performance && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    <p><strong>Venue:</strong> {moment.venueName}</p>
                    <p><strong>Location:</strong> {moment.venueCity}{moment.venueCountry && `, ${moment.venueCountry}`}</p>
                    <p><strong>Date:</strong> {formatDate(moment.performanceDate)}</p>
                    {moment.setName && <p><strong>Set:</strong> {moment.setName}</p>}
                    {moment.songPosition && <p><strong>Song Position:</strong> #{moment.songPosition}</p>}
                    {moment.momentType && <p><strong>Moment Type:</strong> {moment.momentType}</p>}
                    {moment.instruments && <p><strong>Instruments:</strong> {moment.instruments}</p>}
                    {moment.guestAppearances && <p><strong>Guests:</strong> {moment.guestAppearances}</p>}
                    {moment.momentDescription && (
                      <div>
                        <strong>Description:</strong>
                        <p className="text-gray-700 mt-1">{moment.momentDescription}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Technical Details */}
              <div className="space-y-2">
                <SectionHeader 
                  title="Technical Details" 
                  section="technical"
                  count={[moment.audioQuality, moment.videoQuality, moment.createdAt].filter(Boolean).length}
                />
                {expandedSections.technical && (
                  <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                    {moment.audioQuality && <p><strong>Audio Quality:</strong> {moment.audioQuality}</p>}
                    {moment.videoQuality && <p><strong>Video Quality:</strong> {moment.videoQuality}</p>}
                    <p><strong>Uploaded:</strong> {formatDate(moment.createdAt)}</p>
                  </div>
                )}
              </div>

              {/* Context & Emotion */}
              {(moment.emotionalTags || moment.specialOccasion) && (
                <div className="space-y-2">
                  <SectionHeader 
                    title="Context & Emotion" 
                    section="context"
                    count={[moment.emotionalTags, moment.specialOccasion].filter(Boolean).length}
                  />
                  {expandedSections.context && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {moment.emotionalTags && (
                        <div>
                          <strong>Emotional Tags:</strong>
                          <div className="flex flex-wrap gap-1 mt-1">
                            {moment.emotionalTags.split(',').map((tag, index) => (
                              <span key={index} className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">
                                {tag.trim()}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                      {moment.specialOccasion && <p><strong>Special Occasion:</strong> {moment.specialOccasion}</p>}
                    </div>
                  )}
                </div>
              )}

              {/* Experience */}
              {(moment.crowdReaction || moment.personalNote) && (
                <div className="space-y-2">
                  <SectionHeader 
                    title="Experience" 
                    section="experience"
                    count={[moment.crowdReaction, moment.personalNote].filter(Boolean).length}
                  />
                  {expandedSections.experience && (
                    <div className="bg-gray-50 rounded-lg p-4 space-y-2">
                      {moment.crowdReaction && <p><strong>Crowd Reaction:</strong> {moment.crowdReaction}</p>}
                      {moment.personalNote && <p><strong>Personal Note:</strong> {moment.personalNote}</p>}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* NFT Ready Badge */}
            <div className="mt-6 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <div>
                  <h4 className="font-semibold text-green-800">NFT-Ready Moment</h4>
                  <p className="text-green-700 text-sm">
                    This moment has rich metadata and is stored on decentralized storage, ready for NFT minting.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-40">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-90vh">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6 border-b border-gray-200 pb-4">
            <h2 className="text-xl font-semibold text-gray-900">{songName}</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 text-xl font-bold"
            >
              ×
            </button>
          </div>

          <div className="overflow-auto max-h-96">
            {loading ? (
              <div className="text-center py-8">
                <div className="text-gray-500">Loading...</div>
              </div>
            ) : moments.length === 0 ? (
              <div className="text-center py-8">
                <div className="text-gray-500">No moments found</div>
              </div>
            ) : (
              <div className="space-y-3">
                {moments.map((moment) => (
                  <MomentCard key={moment._id} moment={moment} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {selectedMoment && <MomentDetailView moment={selectedMoment} onClose={() => setSelectedMoment(null)} />}
    </div>
  );
};

// Enhanced Upload Modal (FULL VERSION RESTORED)
const EnhancedUploadModal = ({ uploadingMoment, onClose }) => {
  const [step, setStep] = useState('form'); // 'form', 'uploading', 'success'
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  
  // Enhanced form data with all metadata fields
  const [formData, setFormData] = useState({
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    setName: uploadingMoment?.setName || '',
    songPosition: uploadingMoment?.songPosition || 1,
    personalNote: '',
    momentDescription: '', // Description of what happens in the moment
    emotionalTags: '', // Tags like "energetic, emotional, epic"
    specialOccasion: '', // "Birthday show, last song, encore"
    audioQuality: 'good', // good, excellent, poor
    videoQuality: 'good', // good, excellent, poor
    momentType: 'performance', // performance, crowd, backstage, arrival
    instruments: '', // "guitar solo, drum break, piano"
    guestAppearances: '', // Any special guests
    crowdReaction: '', // Description of crowd reaction
    uniqueElements: '' // Anything special about this moment
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleFileSelect = (event) => {
    const selectedFile = event.target.files[0];
    if (!selectedFile) return;

    const maxSize = 6 * 1024 * 1024 * 1024; // 6GB
    if (selectedFile.size > maxSize) {
      setError('File too large. Maximum size is 6GB.');
      return;
    }

    setFile(selectedFile);
    setError('');
  };

  const handleUpload = async () => {
    if (!file) {
      setError('Please select a file first');
      return;
    }

    if (!formData.songName || !formData.venueName || !formData.venueCity) {
      setError('Please fill in required fields: Song Name, Venue, and City');
      return;
    }

    setStep('uploading');
    setUploading(true);
    setError('');
    setUploadProgress(0);

    try {
      // Step 1: Upload file to decentralized storage
      setUploadProgress(10);
      
      const formDataUpload = new FormData();
      formDataUpload.append('file', file);

      const token = localStorage.getItem('token');
      const fileResponse = await fetch('http://localhost:5050/upload-file', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formDataUpload
      });

      if (!fileResponse.ok) {
        const errorData = await fileResponse.json();
        throw new Error(errorData.error || 'File upload failed');
      }

      const fileData = await fileResponse.json();
      console.log('✅ File uploaded:', fileData.fileUri);

      setUploadProgress(70);

      // Step 2: Save enhanced moment with all metadata
      const momentPayload = {
        // Core performance data
        performanceId: uploadingMoment.performanceId,
        performanceDate: formData.performanceDate,
        venueName: formData.venueName,
        venueCity: formData.venueCity,
        venueCountry: formData.venueCountry,
        songName: formData.songName,
        setName: formData.setName,
        songPosition: formData.songPosition,
        
        // Media data
        mediaUrl: fileData.fileUri,
        mediaType: file.type.startsWith('video/') ? 'video' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('image/') ? 'image' : 'unknown',
        fileName: file.name,
        fileSize: file.size,
        
        // Enhanced metadata for NFT
        personalNote: formData.personalNote,
        momentDescription: formData.momentDescription,
        emotionalTags: formData.emotionalTags,
        specialOccasion: formData.specialOccasion,
        audioQuality: formData.audioQuality,
        videoQuality: formData.videoQuality,
        momentType: formData.momentType,
        instruments: formData.instruments,
        guestAppearances: formData.guestAppearances,
        crowdReaction: formData.crowdReaction,
        uniqueElements: formData.uniqueElements
      };

      const momentResponse = await fetch('http://localhost:5050/upload-moment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(momentPayload)
      });

      if (!momentResponse.ok) {
        const errorData = await momentResponse.json();
        throw new Error(errorData.error || 'Failed to save moment');
      }

      const momentData = await momentResponse.json();
      console.log('✅ Enhanced moment saved:', momentData);

      setUploadProgress(100);
      setStep('success');
      setSuccess(true);

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 3000);

    } catch (err) {
      console.error('❌ Upload error:', err);
      setError(err.message);
      setStep('form');
    } finally {
      setUploading(false);
    }
  };

  const inputStyle = {
    width: '100%',
    padding: '0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '6px',
    fontSize: '1rem',
    backgroundColor: '#f9fafb'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.5rem',
    fontWeight: '600',
    color: '#374151',
    fontSize: '0.875rem'
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.7)',
        zIndex: 99999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '1rem'
      }}
      onClick={() => step === 'form' && onClose()}
    >
      <div
        style={{
          backgroundColor: 'white',
          padding: '2rem',
          borderRadius: '12px',
          border: '2px solid #3b82f6',
          maxWidth: '700px',
          width: '100%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {step === 'form' && (
          <div>
            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 'bold' }}>
              🎵 Upload a Moment
            </h2>
            <p style={{ marginBottom: '1.5rem', color: '#666', fontSize: '1rem' }}>
              Create a detailed record of this musical moment for NFT metadata
            </p>

            {error && (
              <div style={{
                backgroundColor: '#fee2e2',
                color: '#dc2626',
                padding: '1rem',
                borderRadius: '6px',
                marginBottom: '1rem'
              }}>
                {error}
              </div>
            )}

            {/* Core Information */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                📝 Core Information
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Song Name *</label>
                  <input
                    type="text"
                    value={formData.songName}
                    onChange={(e) => handleInputChange('songName', e.target.value)}
                    style={inputStyle}
                    placeholder="Enter song name"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Set Name</label>
                  <input
                    type="text"
                    value={formData.setName}
                    onChange={(e) => handleInputChange('setName', e.target.value)}
                    style={inputStyle}
                    placeholder="e.g., Encore, Set 1"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Venue Name *</label>
                  <input
                    type="text"
                    value={formData.venueName}
                    onChange={(e) => handleInputChange('venueName', e.target.value)}
                    style={inputStyle}
                    placeholder="Enter venue name"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Performance Date *</label>
                  <input
                    type="text"
                    value={formData.performanceDate}
                    onChange={(e) => handleInputChange('performanceDate', e.target.value)}
                    style={inputStyle}
                    placeholder="e.g., 08-05-2025"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>City *</label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={(e) => handleInputChange('venueCity', e.target.value)}
                    style={inputStyle}
                    placeholder="Enter city"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Country</label>
                  <input
                    type="text"
                    value={formData.venueCountry}
                    onChange={(e) => handleInputChange('venueCountry', e.target.value)}
                    style={inputStyle}
                    placeholder="Enter country"
                  />
                </div>
              </div>
            </div>

            {/* Moment Description */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                🎭 Moment Details
              </h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Moment Description</label>
                <textarea
                  value={formData.momentDescription}
                  onChange={(e) => handleInputChange('momentDescription', e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px' }}
                  placeholder="Describe what happens in this moment (e.g., 'Epic guitar solo during the bridge', 'Crowd singing along to the chorus')"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Emotional Tags</label>
                  <input
                    type="text"
                    value={formData.emotionalTags}
                    onChange={(e) => handleInputChange('emotionalTags', e.target.value)}
                    style={inputStyle}
                    placeholder="energetic, emotional, epic, intimate"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Moment Type</label>
                  <select
                    value={formData.momentType}
                    onChange={(e) => handleInputChange('momentType', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="performance">Performance</option>
                    <option value="crowd">Crowd Reaction</option>
                    <option value="backstage">Backstage</option>
                    <option value="arrival">Band Arrival</option>
                    <option value="interaction">Artist-Fan Interaction</option>
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Special Occasion</label>
                  <input
                    type="text"
                    value={formData.specialOccasion}
                    onChange={(e) => handleInputChange('specialOccasion', e.target.value)}
                    style={inputStyle}
                    placeholder="Birthday show, final tour date, encore"
                  />
                </div>
                
                <div>
                  <label style={labelStyle}>Instruments Featured</label>
                  <input
                    type="text"
                    value={formData.instruments}
                    onChange={(e) => handleInputChange('instruments', e.target.value)}
                    style={inputStyle}
                    placeholder="guitar solo, drums, piano, bass"
                  />
                </div>
              </div>
            </div>

            {/* Quality & Additional Info */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                📊 Quality & Additional Info
              </h3>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1rem' }}>
                <div>
                  <label style={labelStyle}>Audio Quality</label>
                  <select
                    value={formData.audioQuality}
                    onChange={(e) => handleInputChange('audioQuality', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                
                <div>
                  <label style={labelStyle}>Video Quality</label>
                  <select
                    value={formData.videoQuality}
                    onChange={(e) => handleInputChange('videoQuality', e.target.value)}
                    style={inputStyle}
                  >
                    <option value="excellent">Excellent</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Crowd Reaction</label>
                <textarea
                  value={formData.crowdReaction}
                  onChange={(e) => handleInputChange('crowdReaction', e.target.value)}
                  style={{ ...inputStyle, minHeight: '60px' }}
                  placeholder="Describe the crowd's reaction (e.g., 'Everyone went wild', 'Silent and mesmerized', 'Singing along loudly')"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Guest Appearances</label>
                <input
                  type="text"
                  value={formData.guestAppearances}
                  onChange={(e) => handleInputChange('guestAppearances', e.target.value)}
                  style={inputStyle}
                  placeholder="Any special guests or surprise appearances"
                />
              </div>

              <div style={{ marginBottom: '1rem' }}>
                <label style={labelStyle}>Personal Note</label>
                <textarea
                  value={formData.personalNote}
                  onChange={(e) => handleInputChange('personalNote', e.target.value)}
                  style={{ ...inputStyle, minHeight: '80px' }}
                  placeholder="Your personal thoughts about this moment..."
                />
              </div>
            </div>

            {/* File Upload */}
            <div style={{ marginBottom: '1.5rem' }}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 'bold', marginBottom: '1rem', color: '#1f2937' }}>
                📁 Media File
              </h3>
              
              <div style={{
                border: '2px dashed #d1d5db',
                borderRadius: '8px',
                padding: '2rem',
                textAlign: 'center',
                backgroundColor: '#f9fafb'
              }}>
                <input
                  type="file"
                  id="enhanced-file-upload"
                  style={{ display: 'none' }}
                  accept="video/*,audio/*,image/*"
                  onChange={handleFileSelect}
                />
                <label htmlFor="enhanced-file-upload" style={{ cursor: 'pointer' }}>
                  {!file ? (
                    <div>
                      <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>📁</div>
                      <p style={{ marginBottom: '0.5rem' }}>Click to select media file</p>
                      <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                        Video, Audio, or Image files up to 6GB
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{file.name}</p>
                      <p style={{ color: '#6b7280' }}>
                        {(file.size / 1024 / 1024).toFixed(2)} MB
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div style={{ 
              borderTop: '1px solid #e5e7eb', 
              paddingTop: '1.5rem',
              display: 'flex', 
              gap: '1rem',
              justifyContent: 'flex-end'
            }}>
              <button
                onClick={onClose}
                style={{
                  backgroundColor: '#6b7280',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 1.5rem',
                  cursor: 'pointer',
                  fontSize: '1rem'
                }}
              >
                Cancel
              </button>
              
              <button
                onClick={handleUpload}
                disabled={!file || !formData.songName || !formData.venueName || !formData.venueCity}
                style={{
                  backgroundColor: (!file || !formData.songName || !formData.venueName || !formData.venueCity) 
                    ? '#9ca3af' 
                    : '#10b981',
                  color: 'white',
                  border: 'none',
                  borderRadius: '6px',
                  padding: '0.75rem 2rem',
                  cursor: (!file || !formData.songName || !formData.venueName || !formData.venueCity) 
                    ? 'not-allowed' 
                    : 'pointer',
                  fontSize: '1rem',
                  fontWeight: '600'
                }}
              >
                🚀 Create NFT-Ready Moment
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>
              🚀 Creating Your NFT-Ready Moment
            </h2>
            
            <div style={{
              backgroundColor: '#f3f4f6',
              borderRadius: '8px',
              height: '8px',
              marginBottom: '1rem',
              overflow: 'hidden'
            }}>
              <div
                style={{
                  backgroundColor: '#3b82f6',
                  height: '100%',
                  width: `${uploadProgress}%`,
                  transition: 'width 0.3s ease'
                }}
              />
            </div>
            
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>
              {uploadProgress}% Complete - Saving rich metadata for NFT creation
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ 
              color: '#059669', 
              fontSize: '1.5rem', 
              fontWeight: 'bold',
              marginBottom: '1rem'
            }}>
              NFT-Ready Moment Created!
            </h2>
            <p style={{ color: '#6b7280', fontSize: '1rem' }}>
              Your moment with rich metadata has been saved to decentralized storage and is ready for NFT minting.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

// Smart Song Display Component (SAME AS BEFORE)
const SmartSongDisplay = ({ song, songIndex, setlist, setInfo, handleUploadMoment, user }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMomentButtons, setShowMomentButtons] = useState(false);
  const [selectedMoment, setSelectedMoment] = useState(null);

  useEffect(() => {
    const fetchMoments = async () => {
      try {
        const response = await fetch('http://localhost:5050/moments');
        if (response.ok) {
          const data = await response.json();
          const filteredMoments = data.moments.filter(
            moment => moment.songName === song.name
          );
          setMoments(filteredMoments);
        }
      } catch (err) {
        console.error('Failed to load moments:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchMoments();
  }, [song.name]);

  const handleSongTitleClick = () => {
    if (moments.length > 0) {
      setShowMomentButtons(!showMomentButtons);
    }
  };

  if (loading) {
    return (
      <li className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-3 flex-1">
            <span className="font-medium text-gray-400">{song.name} (loading...)</span>
            {user && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 });
                }}
                className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
              >
                Upload Moment
              </button>
            )}
          </div>
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-gray-100 pb-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          {/* Smart Song Title - Button if has moments, text if not */}
          {moments.length > 0 ? (
            <button
              onClick={handleSongTitleClick}
              className="font-medium text-blue-600 hover:text-blue-800 transition-colors text-left"
            >
              {song.name} ({moments.length} moment{moments.length !== 1 ? 's' : ''})
            </button>
          ) : (
            <span className="font-medium text-gray-900">{song.name}</span>
          )}

          {user && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 });
              }}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Upload Moment
            </button>
          )}
        </div>
      </div>

      {/* Show individual moment buttons when expanded */}
      {showMomentButtons && moments.length > 0 && (
        <div className="mt-3 ml-4">
          <div className="flex flex-wrap gap-2">
            {moments.slice(0, 10).map((moment) => (
              <button
                key={moment._id}
                onClick={() => setSelectedMoment(moment)}
                className="px-3 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm rounded border transition-colors"
              >
                by {moment.user?.displayName || 'Anonymous'}
              </button>
            ))}
            {moments.length > 10 && (
              <span className="px-3 py-2 text-gray-500 text-sm">
                +{moments.length - 10} more
              </span>
            )}
            <button
              onClick={() => setShowMomentButtons(false)}
              className="px-2 py-1 bg-red-100 hover:bg-red-200 text-red-700 text-sm rounded border transition-colors"
              title="Hide moments"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Moment Detail Modal */}
      {selectedMoment && (
        <MomentDetailModal
          moment={selectedMoment}
          onClose={() => setSelectedMoment(null)}
        />
      )}
    </li>
  );
};

// Updated Main Setlists Component
function Setlists({ selectedArtist }) {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedSetlistId, setExpandedSetlistId] = useState(null);
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const { user } = useAuth();

  const fetchSetlists = async (pageToFetch, artist) => {
    if (!artist) return;
    
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/artist/${artist.mbid}/setlists?p=${pageToFetch}`,
        { headers: { Accept: 'application/json' } }
      );

      if (!response.ok) throw new Error('Failed to fetch setlists');

      const data = await response.json();
      if (data && data.setlist) {
        const newSetlists = data.setlist;
        setSetlists((prev) => (pageToFetch === 1 ? newSetlists : [...prev, ...newSetlists]));
        if (newSetlists.length === 0) setHasMore(false);
      } else {
        setError('No setlists found');
        setHasMore(false);
      }
    } catch (err) {
      setError(err.message);
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedArtist) {
      setSetlists([]);
      setPage(1);
      setHasMore(true);
      fetchSetlists(1, selectedArtist);
    }
  }, [selectedArtist]);

  const handleUploadMoment = (setlist, song, setInfo) => {
    if (!user) {
      alert('Please log in to upload moments');
      return;
    }
    
    setUploadingMoment({ 
      performanceId: setlist.id,
      performanceDate: setlist.eventDate,
      venueName: setlist.venue.name,
      venueCity: setlist.venue.city.name,
      venueCountry: setlist.venue.city.country?.name || '',
      songName: song.name,
      setName: setInfo?.name || '',
      songPosition: setInfo?.songIndex || 0
    });
  };

  // Only render if artist is selected (no default message here)
  if (!selectedArtist) {
    return null;
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold">{selectedArtist.name} Setlists</h2>
        <p className="text-gray-600">Upload moments from their performances</p>
      </div>

      {error && <p className="text-red-600 mb-4">Error: {error}</p>}
      
      <div className="space-y-4">
        {setlists.map((setlist) => (
          <div key={setlist.id} className="border border-gray-200 rounded-lg bg-white shadow-sm">
            <div
              onClick={() => setExpandedSetlistId(prev => prev === setlist.id ? null : setlist.id)}
              className="cursor-pointer p-4 hover:bg-gray-50"
            >
              <div className="font-semibold text-lg">
                {setlist.eventDate} - {setlist.venue.name}, {setlist.venue.city.name}
              </div>
            </div>

            {expandedSetlistId === setlist.id && (
              <div className="border-t border-gray-200 p-4">
                {setlist.sets?.set?.map((set, index) => (
                  <div key={index} className="mb-6">
                    {set.name && <h4 className="text-lg font-semibold mb-3">{set.name}</h4>}
                    <ol className="space-y-3">
                      {set.song.map((song, i) => (
                        <SmartSongDisplay
                          key={i}
                          song={song}
                          songIndex={i}
                          setlist={setlist}
                          setInfo={set}
                          handleUploadMoment={handleUploadMoment}
                          user={user}
                        />
                      ))}
                    </ol>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {loading && <p className="text-center py-4">Loading...</p>}
      {!loading && hasMore && setlists.length > 0 && (
        <div className="text-center mt-6">
          <button 
            onClick={() => {
              const nextPage = page + 1;
              fetchSetlists(nextPage, selectedArtist);
              setPage(nextPage);
            }} 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Load More
          </button>
        </div>
      )}

      {uploadingMoment && user && (
        <EnhancedUploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => setUploadingMoment(null)}
        />
      )}
    </div>
  );
}

// FIXED: Main App Component with proper context structure
function MainApp() {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { user, logout, loading } = useAuth(); // NOW PROPERLY INSIDE AuthProvider

  // Handle URL parameters
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const artistId = urlParams.get('artist');
    const artistName = urlParams.get('name');
    
    if (artistId && artistName) {
      setSelectedArtist({ mbid: artistId, name: artistName });
    }
  }, []);

  const handleArtistSelect = (artist) => {
    setSelectedArtist(artist);
    
    // Update URL
    if (artist) {
      const url = new URL(window.location);
      url.searchParams.set('artist', artist.mbid);
      url.searchParams.set('name', artist.name);
      window.history.pushState({}, '', url);
    } else {
      const url = new URL(window.location);
      url.searchParams.delete('artist');
      url.searchParams.delete('name');
      window.history.pushState({}, '', url);
    }
  };

  const handleConcertSelect = (concert) => {
    handleArtistSelect(concert.artist);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  if (showLogin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="bg-white rounded-lg shadow-lg">
          <Login />
          <div className="p-4 border-t">
            <button
              onClick={() => setShowLogin(false)}
              className="w-full px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700"
            >
              Continue Browsing Without Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="p-4 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-4xl font-bold">Concert Moments</h1>
          <div className="flex items-center gap-4">
            {user ? (
              <>
                <span className="text-gray-600">Welcome, {user.displayName}!</span>
                <button
                  onClick={logout}
                  className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                >
                  Logout
                </button>
              </>
            ) : (
              <div className="text-gray-600">
                <span className="mr-3">Browse read-only</span>
                <button
                  onClick={() => setShowLogin(true)}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                  Login to Upload
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Featured Artists */}
        <FeaturedArtists onArtistSelect={handleArtistSelect} />

        {/* Artist Search */}
        <div className="mb-8">
          <ArtistSearch onArtistSelect={handleArtistSelect} currentArtist={selectedArtist} />
        </div>

        {/* Conditional Layout based on artist selection */}
        {selectedArtist ? (
          // When artist is selected: Show Artist Setlists first, then Recent Concerts
          <>
            {/* Artist Setlists - Priority when artist selected */}
            <Setlists selectedArtist={selectedArtist} />
            
            {/* Recent Concerts - Moved down when artist selected */}
            <div className="mt-12 pt-8 border-t border-gray-200">
              <RecentConcerts onConcertSelect={handleConcertSelect} />
            </div>
          </>
        ) : (
          // When no artist selected: Show Recent Concerts first, then "select artist" message
          <>
            {/* Recent Concerts - Priority when no artist selected */}
            <RecentConcerts onConcertSelect={handleConcertSelect} />
            
            {/* Select Artist Message */}
            <div className="text-center py-12 mt-8">
              <div className="text-xl text-gray-600 mb-4">Select an artist to view their setlists</div>
              <div className="text-gray-500">Choose from featured artists above or search for any artist</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// FIXED: App Component - AuthProvider wraps MainApp
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}