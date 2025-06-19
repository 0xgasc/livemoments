// App.js
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import {
  BrowserRouter as Router,
  Routes,
  Route,
  Link,
  useParams,
} from 'react-router-dom';

// Helper: simple slugify to make URL-friendly strings
function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')           // Replace spaces with -
    .replace(/[^\w\-]+/g, '')       // Remove all non-word chars
    .replace(/\-\-+/g, '-')         // Replace multiple - with single -
    .replace(/^-+/, '')             // Trim - from start of text
    .replace(/-+$/, '');            // Trim - from end of text
}

function SongDetail() {
  const { songSlug } = useParams();

  return (
    <div style={{ padding: '1rem' }}>
      <h2>Song Detail</h2>
      <p>Song slug from URL: <code>{songSlug}</code></p>
      <p>This is a dummy detail page for now.</p>
      <Link to="/">Back to Setlists</Link>
    </div>
  );
}

function Setlists() {
  const [setlists, setSetlists] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [expandedSetlistId, setExpandedSetlistId] = useState(null);

  const fetchSetlists = async (pageToFetch) => {
    setLoading(true);
    setError(null);
    try {
      const response = await axios.get(
        'http://localhost:5050/api/rest/1.0/artist/e2305342-0bde-4a2c-aed0-4b88694834de/setlists',
        {
          headers: {
            Accept: 'application/json',
          },
          params: {
            p: pageToFetch,
          },
        }
      );

      if (response.data && response.data.setlist) {
        const newSetlists = response.data.setlist;

        setSetlists((prev) => (pageToFetch === 1 ? newSetlists : [...prev, ...newSetlists]));

        if (newSetlists.length === 0) {
          setHasMore(false);
        }
      } else {
        setError('No setlists found in response');
        setHasMore(false);
      }
    } catch (err) {
      setError(err.message || 'Error fetching data');
      setHasMore(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSetlists(1);
  }, []);

  const handleLoadMore = () => {
    if (!loading && hasMore) {
      const nextPage = page + 1;
      fetchSetlists(nextPage);
      setPage(nextPage);
    }
  };

  const toggleSetlist = (id) => {
    setExpandedSetlistId((prev) => (prev === id ? null : id));
  };

  const handleUploadMoment = (songName) => {
    alert(`Upload a Moment clicked for song: ${songName}`);
    // Dummy for now — replace with your upload logic later
  };

  return (
    <div style={{ padding: '1rem' }}>
      <h1>Unknown Mortal Orchestra Setlists</h1>
      {error && <p style={{ color: 'red' }}>Error: {error}</p>}
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {setlists.map((setlist) => (
          <li
            key={setlist.id}
            onClick={() => toggleSetlist(setlist.id)}
            style={{
              cursor: 'pointer',
              borderBottom: '1px solid #ddd',
              padding: '0.5rem 0',
            }}
          >
            <strong>
              {setlist.eventDate} - {setlist.venue.name}, {setlist.venue.city.name}
            </strong>

            {expandedSetlistId === setlist.id && (
              <div style={{ marginTop: '0.5rem', paddingLeft: '1rem', color: '#555' }}>
                {setlist.sets && setlist.sets.set && setlist.sets.set.length > 0 ? (
                  setlist.sets.set.map((set, index) => (
                    <div key={index} style={{ marginBottom: '1rem' }}>
                      {set.name && <h4>{set.name}</h4>}
                      <ol>
                        {set.song.map((song, i) => (
                          <li key={i} style={{ marginBottom: '0.25rem' }}>
                            <Link
                              to={`/song/${slugify(song.name)}`}
                              onClick={(e) => e.stopPropagation()} // prevent toggling setlist collapse
                              style={{ marginRight: '1rem' }}
                            >
                              {song.name}
                            </Link>
                            <button
                              onClick={(e) => {
                                e.stopPropagation(); // prevent toggling setlist collapse
                                handleUploadMoment(song.name);
                              }}
                            >
                              Upload a Moment
                            </button>
                          </li>
                        ))}
                      </ol>
                    </div>
                  ))
                ) : (
                  <p>No songs available for this setlist.</p>
                )}
              </div>
            )}
          </li>
        ))}
      </ul>

      {loading && <p>Loading...</p>}
      {!loading && hasMore && (
        <button onClick={handleLoadMore} style={{ marginTop: '1rem' }}>
          Load More
        </button>
      )}
      {!hasMore && <p>No more setlists to load.</p>}
    </div>
  );
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Setlists />} />
        <Route path="/song/:songSlug" element={<SongDetail />} />
      </Routes>
    </Router>
  );
}
