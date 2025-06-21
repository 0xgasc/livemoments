import React, { useEffect, useState, createContext, useContext } from 'react';
import { styles } from './styles';
import { formatDate, formatShortDate, formatFileSize, FEATURED_ARTISTS } from './utils';

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

// Simplified Artist Search Component
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
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/search/artists?artistName=${encodeURIComponent(query)}`,
        { headers: { Accept: 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        const artists = (data.artist || [])
          .filter(artist => artist.name && artist.mbid)
          .sort((a, b) => {
            // Exact match gets priority
            const aExact = a.name.toLowerCase() === query.toLowerCase();
            const bExact = b.name.toLowerCase() === query.toLowerCase();
            if (aExact && !bExact) return -1;
            if (bExact && !aExact) return 1;
            
            // Then by name length (shorter = more likely main artist)
            return a.name.length - b.name.length;
          })
          .slice(0, 10);
        
        setSearchResults(artists);
        setShowResults(true);
      }
    } catch (err) {
      console.error('Artist search error:', err);
    } finally {
      setSearching(false);
    }
  };

  const handleSearch = (e) => {
    const query = e.target.value;
    setSearchQuery(query);
    
    if (window.searchTimeout) {
      clearTimeout(window.searchTimeout);
    }
    
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

      {showResults && (
        <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto">
          {searchResults.length === 0 ? (
            <div className="px-4 py-3 text-gray-500 text-center">
              No artists found
            </div>
          ) : (
            searchResults.map((artist) => (
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
            ))
          )}
        </div>
      )}

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

// Simplified Featured Artists Component
const FeaturedArtists = ({ onArtistSelect }) => {
  const [loading, setLoading] = useState({});

  const handleFeaturedArtistClick = async (artistName) => {
    setLoading(prev => ({ ...prev, [artistName]: true }));
    
    try {
      // Search for the artist to get full data including correct mbid
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/search/artists?artistName=${encodeURIComponent(artistName)}`,
        { headers: { Accept: 'application/json' } }
      );

      if (response.ok) {
        const data = await response.json();
        const artists = data.artist || [];
        
        // Find exact match
        const exactMatch = artists.find(a => 
          a.name.toLowerCase() === artistName.toLowerCase()
        );
        
        if (exactMatch) {
          onArtistSelect(exactMatch);
        } else if (artists.length > 0) {
          // Fallback to first result
          onArtistSelect(artists[0]);
        } else {
          console.error('Artist not found:', artistName);
          alert(`Could not find artist: ${artistName}`);
        }
      }
    } catch (err) {
      console.error('Error fetching artist:', err);
      alert('Error loading artist data');
    } finally {
      setLoading(prev => ({ ...prev, [artistName]: false }));
    }
  };

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-center mb-6">Featured Artists</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
        {FEATURED_ARTISTS.map((artist) => (
          <button
            key={artist.mbid}
            onClick={() => handleFeaturedArtistClick(artist.name)}
            disabled={loading[artist.name]}
            className="p-4 bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow border border-gray-200 hover:border-blue-300 disabled:opacity-50"
          >
            <div className="text-sm font-medium text-center text-gray-900 leading-tight">
              {loading[artist.name] ? 'Loading...' : artist.name}
            </div>
          </button>
        ))}
      </div>
    </div>
  );
};

// Simplified Recent Concerts Component
const RecentConcerts = ({ onConcertSelect }) => {
  const [recentConcerts, setRecentConcerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRecentConcerts = async () => {
      try {
        const response = await fetch(
          `http://localhost:5050/api/rest/1.0/search/setlists?p=1`,
          { headers: { Accept: 'application/json' } }
        );

        if (response.ok) {
          const data = await response.json();
          const concerts = (data.setlist || [])
            .filter(concert => 
              concert.artist?.name && 
              concert.venue?.name && 
              concert.venue?.city?.name &&
              concert.eventDate &&
              concert.sets?.set?.some(set => 
                set.song && Array.isArray(set.song) && set.song.length > 0
              )
            )
            .slice(0, 10);

          setRecentConcerts(concerts);
        }
      } catch (err) {
        console.error('Error fetching recent concerts:', err);
        setRecentConcerts([]);
      } finally {
        setLoading(false);
      }
    };

    fetchRecentConcerts();
  }, []);

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

  if (recentConcerts.length === 0) {
    return null;
  }

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-bold text-center mb-6">Latest Concerts</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        {recentConcerts.map((concert) => {
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
                  {formatShortDate(concert.eventDate)}
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

// Moment Detail Modal (Read-only)
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

  const inputStyle = isOwner && isEditing ? styles.input : styles.inputReadonly;

  return (
    <div style={styles.modal.overlay} onClick={onClose}>
      <div style={styles.modal.content} onClick={(e) => e.stopPropagation()}>
        <div style={styles.modal.header}>
          <div>
            <h2 style={styles.modal.title}>Moment Details</h2>
            <p style={styles.modal.subtitle}>
              {isOwner ? 'Your moment details' : `Moment by ${moment.user?.displayName || 'Anonymous'}`}
            </p>
          </div>
          {isOwner && (
            <button
              onClick={() => setIsEditing(!isEditing)}
              style={isEditing ? styles.button.danger : styles.button.primary}
            >
              {isEditing ? 'Cancel Edit' : 'Edit'}
            </button>
          )}
        </div>

        {/* Core Information */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>📝 Core Information</h3>
          
          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Song Name</label>
              <input type="text" value={moment.songName || ''} readOnly style={styles.inputReadonly} />
            </div>
            
            <div>
              <label style={styles.label}>Set Name</label>
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

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Venue</label>
              <input type="text" value={moment.venueName || ''} readOnly style={styles.inputReadonly} />
            </div>
            
            <div>
              <label style={styles.label}>Location</label>
              <input 
                type="text" 
                value={`${moment.venueCity}${moment.venueCountry ? ', ' + moment.venueCountry : ''}`} 
                readOnly 
                style={styles.inputReadonly} 
              />
            </div>
          </div>
        </div>

        {/* Moment Details */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>🎭 Moment Details</h3>
          
          <div style={{ marginBottom: '1rem' }}>
            <label style={styles.label}>Description</label>
            <textarea
              value={isEditing ? editedData.momentDescription : (moment.momentDescription || '')}
              readOnly={!isEditing}
              onChange={(e) => isEditing && setEditedData({...editedData, momentDescription: e.target.value})}
              style={isOwner && isEditing ? styles.textarea : {...styles.textarea, backgroundColor: '#f5f5f5'}}
            />
          </div>

          <div style={styles.section.grid}>
            <div>
              <label style={styles.label}>Type</label>
              {isEditing ? (
                <select
                  value={editedData.momentType}
                  onChange={(e) => setEditedData({...editedData, momentType: e.target.value})}
                  style={styles.input}
                >
                  <option value="performance">Performance</option>
                  <option value="crowd">Crowd Reaction</option>
                  <option value="backstage">Backstage</option>
                  <option value="arrival">Band Arrival</option>
                  <option value="interaction">Artist-Fan Interaction</option>
                </select>
              ) : (
                <input type="text" value={moment.momentType || ''} readOnly style={styles.inputReadonly} />
              )}
            </div>
            
            <div>
              <label style={styles.label}>Quality</label>
              <input 
                type="text" 
                value={`Audio: ${moment.audioQuality || 'N/A'}, Video: ${moment.videoQuality || 'N/A'}`} 
                readOnly 
                style={styles.inputReadonly} 
              />
            </div>
          </div>
        </div>

        {/* Media File */}
        <div style={styles.section.container}>
          <h3 style={styles.section.title}>📁 Media File</h3>
          
          <div style={styles.mediaDisplay.container}>
            <p style={styles.mediaDisplay.fileName}>{moment.fileName}</p>
            <p style={styles.mediaDisplay.fileInfo}>
              {moment.fileSize ? formatFileSize(moment.fileSize) : 'Unknown size'} • {moment.mediaType}
            </p>
            <button onClick={handleDownload} style={styles.button.success}>
              Decentralized Storage Link
            </button>
            <p style={styles.mediaDisplay.warning}>
              ⚠️ This will download the file to your computer
            </p>
          </div>
        </div>

        {/* Actions */}
        <div style={styles.footerActions.container}>
          <button onClick={onClose} style={styles.button.secondary}>
            Close
          </button>
          
          {isOwner && isEditing && (
            <button
              onClick={handleSave}
              disabled={saving}
              style={saving ? styles.button.disabled : styles.button.success}
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// Enhanced Upload Modal
const EnhancedUploadModal = ({ uploadingMoment, onClose }) => {
  const [step, setStep] = useState('form');
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState('');
  
  const [formData, setFormData] = useState({
    songName: uploadingMoment?.songName || '',
    venueName: uploadingMoment?.venueName || '',
    venueCity: uploadingMoment?.venueCity || '',
    venueCountry: uploadingMoment?.venueCountry || '',
    performanceDate: uploadingMoment?.performanceDate || '',
    setName: uploadingMoment?.setName || '',
    songPosition: uploadingMoment?.songPosition || 1,
    personalNote: '',
    momentDescription: '',
    emotionalTags: '',
    specialOccasion: '',
    audioQuality: 'good',
    videoQuality: 'good',
    momentType: 'performance',
    instruments: '',
    guestAppearances: '',
    crowdReaction: '',
    uniqueElements: ''
  });

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
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
      setUploadProgress(70);

      const momentPayload = {
        performanceId: uploadingMoment.performanceId,
        performanceDate: formData.performanceDate,
        venueName: formData.venueName,
        venueCity: formData.venueCity,
        venueCountry: formData.venueCountry,
        songName: formData.songName,
        setName: formData.setName,
        songPosition: formData.songPosition,
        mediaUrl: fileData.fileUri,
        mediaType: file.type.startsWith('video/') ? 'video' : 
                   file.type.startsWith('audio/') ? 'audio' : 
                   file.type.startsWith('image/') ? 'image' : 'unknown',
        fileName: file.name,
        fileSize: file.size,
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

      setUploadProgress(100);
      setStep('success');

      setTimeout(() => {
        onClose();
        window.location.reload();
      }, 3000);

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message);
      setStep('form');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div style={styles.modal.overlay} onClick={() => step === 'form' && onClose()}>
      <div style={styles.modal.content} onClick={(e) => e.stopPropagation()}>
        {step === 'form' && (
          <div>
            <h2 style={styles.modal.title}>🎵 Upload a Moment</h2>
            <p style={styles.modal.subtitle}>Create a detailed record of this musical moment for NFT metadata</p>

            {error && <div style={styles.message.error}>{error}</div>}

            {/* Core Information */}
            <div style={styles.section.container}>
              <h3 style={styles.section.title}>📝 Core Information</h3>
              
              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Song Name *</label>
                  <input
                    type="text"
                    value={formData.songName}
                    onChange={(e) => handleInputChange('songName', e.target.value)}
                    style={styles.input}
                    placeholder="Enter song name"
                  />
                </div>
                
                <div>
                  <label style={styles.label}>Set Name</label>
                  <input
                    type="text"
                    value={formData.setName}
                    onChange={(e) => handleInputChange('setName', e.target.value)}
                    style={styles.input}
                    placeholder="e.g., Encore, Set 1"
                  />
                </div>
              </div>

              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Venue Name *</label>
                  <input
                    type="text"
                    value={formData.venueName}
                    onChange={(e) => handleInputChange('venueName', e.target.value)}
                    style={styles.input}
                  />
                </div>
                
                <div>
                  <label style={styles.label}>City *</label>
                  <input
                    type="text"
                    value={formData.venueCity}
                    onChange={(e) => handleInputChange('venueCity', e.target.value)}
                    style={styles.input}
                  />
                </div>
              </div>
            </div>

            {/* Moment Details */}
            <div style={styles.section.container}>
              <h3 style={styles.section.title}>🎭 Moment Details</h3>
              
              <div style={{ marginBottom: '1rem' }}>
                <label style={styles.label}>Moment Description</label>
                <textarea
                  value={formData.momentDescription}
                  onChange={(e) => handleInputChange('momentDescription', e.target.value)}
                  style={styles.textarea}
                  placeholder="Describe what happens in this moment"
                />
              </div>

              <div style={styles.section.grid}>
                <div>
                  <label style={styles.label}>Moment Type</label>
                  <select
                    value={formData.momentType}
                    onChange={(e) => handleInputChange('momentType', e.target.value)}
                    style={styles.input}
                  >
                    <option value="performance">Performance</option>
                    <option value="crowd">Crowd Reaction</option>
                    <option value="backstage">Backstage</option>
                    <option value="arrival">Band Arrival</option>
                    <option value="interaction">Artist-Fan Interaction</option>
                  </select>
                </div>
                
                <div>
                  <label style={styles.label}>Emotional Tags</label>
                  <input
                    type="text"
                    value={formData.emotionalTags}
                    onChange={(e) => handleInputChange('emotionalTags', e.target.value)}
                    style={styles.input}
                    placeholder="energetic, emotional, epic"
                  />
                </div>
              </div>
            </div>

            {/* File Upload */}
            <div style={styles.section.container}>
              <h3 style={styles.section.title}>📁 Media File</h3>
              
              <div style={styles.fileUpload.container}>
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
                      <div style={styles.fileUpload.icon}>📁</div>
                      <p style={styles.fileUpload.text}>Click to select media file</p>
                      <p style={styles.fileUpload.subtext}>Video, Audio, or Image files up to 6GB</p>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>{file.name}</p>
                      <p style={{ color: '#6b7280' }}>{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            {/* Actions */}
            <div style={styles.footerActions.container}>
              <button onClick={onClose} style={styles.button.secondary}>Cancel</button>
              
              <button
                onClick={handleUpload}
                disabled={!file || !formData.songName || !formData.venueName || !formData.venueCity}
                style={(!file || !formData.songName || !formData.venueName || !formData.venueCity) 
                  ? styles.button.disabled 
                  : styles.button.primary}
              >
                🚀 Create NFT-Ready Moment
              </button>
            </div>
          </div>
        )}

        {step === 'uploading' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <h2 style={styles.modal.title}>🚀 Creating Your NFT-Ready Moment</h2>
            
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
              {uploadProgress}% Complete - Saving to decentralized storage
            </p>
          </div>
        )}

        {step === 'success' && (
          <div style={{ textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>✅</div>
            <h2 style={{ ...styles.modal.title, color: '#059669' }}>
              NFT-Ready Moment Created!
            </h2>
            <p style={{ color: '#6b7280' }}>Your moment is ready for NFT minting.</p>
          </div>
        )}
      </div>
    </div>
  );
};

// Smart Song Display Component
const SmartSongDisplay = ({ song, songIndex, setlist, setInfo, handleUploadMoment, user }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMoments, setShowMoments] = useState(false);
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

  if (loading) {
    return (
      <li className="border-b border-gray-100 pb-3">
        <div className="flex justify-between items-center">
          <span className="font-medium text-gray-400">{song.name} (loading...)</span>
          {user && (
            <button
              onClick={() => handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 })}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Upload Moment
            </button>
          )}
        </div>
      </li>
    );
  }

  return (
    <li className="border-b border-gray-100 pb-3">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-3 flex-1">
          {moments.length > 0 ? (
            <button
              onClick={() => setShowMoments(!showMoments)}
              className="font-medium text-blue-600 hover:text-blue-800 transition-colors text-left"
            >
              {song.name} ({moments.length} moment{moments.length !== 1 ? 's' : ''})
            </button>
          ) : (
            <span className="font-medium text-gray-900">{song.name}</span>
          )}

          {user && (
            <button
              onClick={() => handleUploadMoment(setlist, song, { name: setInfo.name, songIndex: songIndex + 1 })}
              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
            >
              Upload Moment
            </button>
          )}
        </div>
      </div>

      {showMoments && moments.length > 0 && (
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
              <span className="px-3 py-2 text-gray-500 text-sm">+{moments.length - 10} more</span>
            )}
          </div>
        </div>
      )}

      {selectedMoment && (
        <MomentDetailModal moment={selectedMoment} onClose={() => setSelectedMoment(null)} />
      )}
    </li>
  );
};

// Main Setlists Component
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

  if (!selectedArtist) return null;

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

// Main App Component
function MainApp() {
  const [selectedArtist, setSelectedArtist] = useState(null);
  const [showLogin, setShowLogin] = useState(false);
  const { user, logout, loading } = useAuth();

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

        {/* Artist Search */}
        <div className="mb-8">
          <ArtistSearch onArtistSelect={handleArtistSelect} currentArtist={selectedArtist} />
        </div>

        {/* Conditional Layout */}
        {selectedArtist ? (
          <>
            <Setlists selectedArtist={selectedArtist} />
            
            <div className="mt-12 pt-8 border-t border-gray-200">
              <RecentConcerts onConcertSelect={handleConcertSelect} />
            </div>

            <div className="mt-12 pt-8 border-t border-gray-200">
              <FeaturedArtists onArtistSelect={handleArtistSelect} />
            </div>
          </>
        ) : (
          <>
            <FeaturedArtists onArtistSelect={handleArtistSelect} />
            
            <RecentConcerts onConcertSelect={handleConcertSelect} />
            
            <div className="text-center py-12 mt-8">
              <div className="text-xl text-gray-600 mb-4">Search for any artist above to view their setlists</div>
              <div className="text-gray-500">Or choose from featured artists to get started</div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// App Component
export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}