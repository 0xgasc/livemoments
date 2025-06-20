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

// Enhanced Upload Modal with Editable Fields
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

// Moments Display Component
const MomentsDisplay = ({ performanceId, songName }) => {
  const [moments, setMoments] = useState([]);
  const [loading, setLoading] = useState(false);

  const fetchMoments = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      if (!token) return;

      const response = await fetch('http://localhost:5050/moments', {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (response.ok) {
        const data = await response.json();
        const filteredMoments = data.moments.filter(
          moment => moment.performanceId === performanceId && moment.songName === songName
        );
        setMoments(filteredMoments);
      }
    } catch (err) {
      console.error('Failed to load moments:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMoments();
  }, [performanceId, songName]);

  if (loading) return <div className="p-2 text-gray-600">Loading moments...</div>;
  if (moments.length === 0) return null;

  return (
    <div className="mt-4 pl-4">
      <h5 className="text-sm font-medium text-gray-600 mb-2">
        Moments ({moments.length})
      </h5>
      <div className="flex flex-wrap gap-2">
        {moments.map((moment) => (
          <div key={moment._id} className="border border-gray-200 rounded p-3 bg-gray-50">
            <div className="text-xs text-gray-500 mb-1">
              by {moment.user?.displayName || 'Anonymous'} • {new Date(moment.createdAt).toLocaleDateString()}
            </div>
            <a
              href={moment.mediaUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 text-sm"
            >
              View Moment 🎵
            </a>
          </div>
        ))}
      </div>
    </div>
  );
};

// Main Setlists Component
function Setlists() {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedSetlistId, setExpandedSetlistId] = useState(null);
  const [uploadingMoment, setUploadingMoment] = useState(null);
  const { user, logout } = useAuth();

  const fetchSetlists = async (pageToFetch) => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        `http://localhost:5050/api/rest/1.0/artist/e2305342-0bde-4a2c-aed0-4b88694834de/setlists?p=${pageToFetch}`,
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
    fetchSetlists(1);
  }, []);

  const handleUploadMoment = (setlist, song, setInfo) => {
    console.log('🔍 Upload moment clicked:', { 
      performanceId: setlist.id,
      songName: song.name,
      venue: setlist.venue.name,
      city: setlist.venue.city.name 
    });
    
    const token = localStorage.getItem('token');
    if (!token) {
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

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Unknown Mortal Orchestra Setlists</h1>
        <div className="flex items-center gap-4">
          <span className="text-gray-600">Welcome, {user.displayName}!</span>
          <button
            onClick={logout}
            className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Logout
          </button>
        </div>
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
                        <li key={i} className="border-b border-gray-100 pb-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="font-medium">{song.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                console.log('🔥 Button clicked for:', song.name);
                                handleUploadMoment(setlist, song, { name: set.name, songIndex: i + 1 });
                              }}
                              className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700"
                            >
                              Upload Moment
                            </button>
                          </div>
                          <MomentsDisplay performanceId={setlist.id} songName={song.name} />
                        </li>
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
      {!loading && hasMore && (
        <div className="text-center mt-6">
          <button 
            onClick={() => {
              const nextPage = page + 1;
              fetchSetlists(nextPage);
              setPage(nextPage);
            }} 
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            Load More
          </button>
        </div>
      )}

      {/* Enhanced Upload Modal */}
      {uploadingMoment && (
        <EnhancedUploadModal
          uploadingMoment={uploadingMoment}
          onClose={() => setUploadingMoment(null)}
        />
      )}
    </div>
  );
}

// Protected Route Component
const ProtectedRoute = ({ children }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-xl">Loading...</div>
      </div>
    );
  }

  return user ? children : <Login />;
};

// Main App Component
export default function App() {
  return (
    <AuthProvider>
      <div className="min-h-screen bg-gray-50">
        <ProtectedRoute>
          <Setlists />
        </ProtectedRoute>
      </div>
    </AuthProvider>
  );
}