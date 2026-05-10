import React, { useState, useEffect, useRef } from 'react';
import * as faceapi from 'face-api.js';
import {
  Camera,
  Users,
  AlertCircle,
  ArrowLeft,
  ShieldCheck,
  UserCheck,
  Activity,
  FileText,
  Clock,
  Calendar,
  BarChart2,
  Search,
  LogOut
} from 'lucide-react';
import './App.css';

function App() {
  const [currentPage, setCurrentPage] = useState(localStorage.getItem('currentPage') || 'login');
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [captureVideo, setCaptureVideo] = useState(false);
  const [attendance, setAttendance] = useState([]);
  const [error, setError] = useState(null);
  const [testing, setTesting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [employeeId, setEmployeeId] = useState('');
  const [department, setDepartment] = useState('');
  const [isLoggedIn, setIsLoggedIn] = useState(localStorage.getItem('isLoggedIn') === 'true');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const videoRef = useRef();
  const canvasRef = useRef();

  const videoHeight = 480;
  const videoWidth = 640;

  useEffect(() => {
    localStorage.setItem('isLoggedIn', isLoggedIn);
    localStorage.setItem('currentPage', currentPage);
  }, [isLoggedIn, currentPage]);

  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        const response = await fetch('/api/attendance');
        const data = await response.json();
        setAttendance(data.reverse());
      } catch (err) {
        console.error("Failed to fetch attendance:", err);
      }
    };

    fetchAttendance();

    const loadModels = async () => {
      const MODEL_URL = '/models';

      try {
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
          faceapi.nets.faceExpressionNet.loadFromUri(MODEL_URL),
        ]);

        setModelsLoaded(true);
      } catch (err) {
        console.error("Error loading models:", err);
        setError("Failed to load AI models.");
      }
    };

    loadModels();
  }, []);

  const startVideo = () => {
    if (!modelsLoaded) {
      setError("AI models are still loading. Please wait...");
      return;
    }
    setCaptureVideo(true);
    setError(null);

    navigator.mediaDevices
      .getUserMedia({ video: { width: 640, height: 480 } })
      .then(stream => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      })
      .catch(err => {
        console.error(err);
        setCaptureVideo(false);
        setError("Camera access denied.");
      });
  };

  const closeVideo = () => {
    setCaptureVideo(false);

    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      videoRef.current.srcObject = null;
    }
  };

  const handleVideoOnPlay = () => {
    const interval = setInterval(async () => {
      if (!captureVideo) {
        clearInterval(interval);
        return;
      }

      if (
        canvasRef.current &&
        videoRef.current &&
        videoRef.current.readyState === 4
      ) {
        const displaySize = {
          width: videoWidth,
          height: videoHeight
        };

        faceapi.matchDimensions(canvasRef.current, displaySize);

        const detections = await faceapi
          .detectAllFaces(
            videoRef.current,
            new faceapi.TinyFaceDetectorOptions()
          )
          .withFaceLandmarks()
          .withFaceExpressions();

        const resizedDetections = faceapi.resizeResults(
          detections,
          displaySize
        );

        const context = canvasRef.current.getContext('2d');

        if (context) {
          context.clearRect(0, 0, videoWidth, videoHeight);

          faceapi.draw.drawDetections(
            canvasRef.current,
            resizedDetections
          );

          faceapi.draw.drawFaceLandmarks(
            canvasRef.current,
            resizedDetections
          );
        }

        if (detections.length > 0) {
          const name = employeeId
            ? `ID: ${employeeId} (${department})`
            : "Detected User";

          markAttendance(name, "Sign In");
        }
      }
    }, 2000);
  };

  const handleSignIn = async () => {
    if (!employeeId || !department) {
      alert("Please enter Employee ID and Department.");
      return;
    }

    setTesting(true);

    await markAttendance(
      `ID: ${employeeId} (${department})`,
      "Sign In"
    );

    setTesting(false);
  };

  const handleSignOut = async () => {
    if (!employeeId || !department) {
      alert("Please enter Employee ID and Department.");
      return;
    }

    setTesting(true);

    await markAttendance(
      `ID: ${employeeId} (${department})`,
      "Sign Out"
    );

    setTesting(false);
  };

  const calculateDuration = (startTime, endTime) => {
    if (!startTime || !endTime) return 'N/A';

    const start = new Date(startTime);
    const end = new Date(endTime);

    const diff = Math.max(0, end - start);

    const hours = Math.floor(diff / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    const seconds = Math.floor((diff % 60000) / 1000);

    return `${hours}h ${minutes}m ${seconds}s`;
  };

  const markAttendance = async (name, type = "Sign In") => {
    const now = new Date();

    const time = now.toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });

    const date = now.toISOString().split('T')[0];
    const timestamp = now.toISOString();

    let updatedEntry = null;
    let mode = "new";
    let imageData = null;

    // Capture image for all scans
    if (videoRef.current) {
      const captureCanvas = document.createElement('canvas');
      captureCanvas.width = videoWidth;
      captureCanvas.height = videoHeight;
      const ctx = captureCanvas.getContext('2d');
      ctx.drawImage(videoRef.current, 0, 0, videoWidth, videoHeight);
      imageData = captureCanvas.toDataURL('image/jpeg', 0.8);
    }

    setAttendance(prev => {
      const nowMs = now.getTime();

      // 1. Prevent rapid-fire duplicates (within 5 seconds)
      const isRecentDuplicate = prev.some(item => 
        item.name === name && 
        Math.abs(nowMs - new Date(item.timestamp).getTime()) < 5000
      );
      if (isRecentDuplicate && type === "Sign In") return prev;

      // 2. Prevent duplicate Sign In if already active
      if (type === "Sign In") {
        const hasActiveSession = prev.some(item => 
          item.name === name && 
          item.date === date && 
          !item.signOut
        );
        if (hasActiveSession) return prev;
      }

      if (type === "Sign Out") {
        const activeIndex = prev.findLastIndex(item =>
          item.name === name &&
          item.date === date &&
          !item.signOut
        );

        if (activeIndex !== -1) {
          const duration = calculateDuration(prev[activeIndex].timestamp, timestamp);
          const updated = [...prev];
          updated[activeIndex] = {
            ...prev[activeIndex],
            signOut: time,
            signOutTimestamp: timestamp,
            duration
          };
          updatedEntry = updated[activeIndex];
          mode = "update";
          return updated;
        }
        return prev;
      }

      // New Sign In
      const newEntry = {
        name,
        date,
        signIn: time,
        timestamp,
        signOut: null,
        duration: 'N/A'
      };
      updatedEntry = newEntry;
      mode = "new";
      return [newEntry, ...prev];
    });

    // Sync with backend outside of setAttendance to avoid side-effects in render/setter
    if (updatedEntry) {
      const payload = mode === "new" ? { ...updatedEntry, image: imageData } : updatedEntry;
      await syncWithBackend(payload, mode);
    }
  };

  const syncWithBackend = async (data, mode) => {
    try {
      await fetch('/api/attendance', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ...data, mode })
      });
    } catch (err) {
      console.error("Backend sync failed:", err);
    }
  };

  // LOGOUT FUNCTION
  const handleLogout = () => {
    closeVideo();

    setIsLoggedIn(false);
    setCurrentPage('login');

    setUsername('');
    setPassword('');

    setEmployeeId('');
    setDepartment('');
  };

  const renderHome = () => (
    <div className="home-container">
      <div className="nav-cards">

        <div
          className="nav-card"
          onClick={() => setCurrentPage('admin')}
        >
          <ShieldCheck size={40} />
          <h3>Admin Dashboard</h3>
          <button className="btn-primary">
            Enter Admin Portal
          </button>
        </div>

        <div
          className="nav-card"
          onClick={() => setCurrentPage('employee')}
        >
          <UserCheck size={40} />
          <h3>Employee Attendance</h3>
          <button className="btn-primary">
            Mark Attendance
          </button>
        </div>

        <div
          className="nav-card"
          onClick={() => setCurrentPage('summary')}
        >
          <FileText size={40} />
          <h3>Attendance Summary</h3>
          <button
            className="btn-primary"
            style={{ background: 'var(--secondary)' }}
          >
            View Summary
          </button>
        </div>

      </div>
    </div>
  );

  const renderAdmin = () => {
    const filteredAttendance = attendance.filter(item =>
      item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
      <div className="admin-view">

        <div className="view-header">
          <button
            className="btn-back"
            onClick={() => setCurrentPage('home')}
          >
            <ArrowLeft size={12} />
            Back
          </button>

          <h4>Admin Control Center</h4>
        </div>

        <div className="attendance-panel">

          <div
            style={{
              padding: '1rem',
              display: 'flex',
              justifyContent: 'space-between'
            }}
          >

            <h3>
              <FileText size={20} />
              Full Attendance Log
            </h3>

            <input
              type="text"
              placeholder="Search..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse'
            }}
          >
            <thead>
              <tr>
                <th>Name</th>
                <th>Date</th>
                <th>Sign In</th>
                <th>Sign Out</th>
                <th>Duration</th>
              </tr>
            </thead>

            <tbody>
              {(() => {
                // Group filteredAttendance by Name and Date
                const grouped = filteredAttendance.reduce((acc, item) => {
                  // Normalize date format for grouping (handle both YYYY-MM-DD and M/D/YYYY)
                  let normalizedDate = item.date;
                  if (item.date && item.date.includes('/')) {
                    const parts = item.date.split('/');
                    if (parts.length === 3) {
                       // Convert M/D/YYYY to YYYY-MM-DD for sorting/grouping
                       const year = parts[2];
                       const month = parts[1].padStart(2, '0');
                       const day = parts[0].padStart(2, '0');
                       normalizedDate = `${year}-${month}-${day}`;
                    }
                  }

                  const key = `${item.name}-${normalizedDate}`;
                  if (!acc[key]) {
                    acc[key] = { ...item, date: normalizedDate, totalMs: 0, sessions: [] };
                  }
                  
                  // Deduplicate: If multiple sessions have exact same timestamp, prefer the one with signOut
                  const existingIndex = acc[key].sessions.findIndex(s => s.timestamp === item.timestamp);
                  if (existingIndex !== -1) {
                    if (item.signOut && !acc[key].sessions[existingIndex].signOut) {
                      acc[key].sessions[existingIndex] = item;
                    }
                  } else {
                    acc[key].sessions.push(item);
                  }
                  
                  return acc;
                }, {});

                const groupedArray = Object.values(grouped).map(group => {
                  const totalMs = group.sessions.reduce((sum, s) => {
                    if (s.timestamp && s.signOutTimestamp) {
                      return sum + Math.max(0, new Date(s.signOutTimestamp) - new Date(s.timestamp));
                    }
                    return sum;
                  }, 0);
                  return { ...group, totalMs };
                });

                return groupedArray.map((group, index) => {
                  const totalSeconds = Math.floor(group.totalMs / 1000);
                  const h = Math.floor(totalSeconds / 3600);
                  const m = Math.floor((totalSeconds % 3600) / 60);
                  const s = totalSeconds % 60;
                  const totalDurationStr = `${h}h ${m}m ${s}s`;

                  const sortedSessions = [...group.sessions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                  const firstIn = sortedSessions[0].signIn;
                  const lastSession = sortedSessions[sortedSessions.length - 1];
                  const lastOut = lastSession.signOut || 'Active';

                  return (
                    <tr key={index}>
                      <td style={{ padding: '0.75rem', fontWeight: '600' }}>{group.name}</td>
                      <td style={{ padding: '0.75rem' }}>{group.date}</td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="login-time-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                          {firstIn}
                        </span>
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        {lastOut !== 'Active' ? (
                          <span className="login-time-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                            {lastOut}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Active</span>
                        )}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span className="login-time-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', minWidth: '100px', display: 'inline-block', textAlign: 'center' }}>
                          {totalDurationStr}
                        </span>
                      </td>
                    </tr>
                  );
                });
              })()}
            </tbody>

          </table>

        </div>
      </div>
    );
  };

  const renderSummary = () => (
    <div className="summary-view">

      <div className="view-header">
        <button
          className="btn-back"
          onClick={() => setCurrentPage('home')}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <h2>Attendance Summary</h2>
      </div>

      <div className="attendance-panel" style={{ height: 'auto', maxHeight: '70vh', overflowY: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
          <thead>
            <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Name</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Date</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Sign In</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Sign Out</th>
              <th style={{ padding: '1rem', color: 'var(--text-muted)' }}>Duration</th>
            </tr>
          </thead>
          <tbody>
            {(() => {
              // Group attendance by Name and Date
              const grouped = attendance.reduce((acc, item) => {
                // Normalize date format for grouping
                let normalizedDate = item.date;
                if (item.date && item.date.includes('/')) {
                  const parts = item.date.split('/');
                  if (parts.length === 3) {
                     const year = parts[2];
                     const month = parts[1].padStart(2, '0');
                     const day = parts[0].padStart(2, '0');
                     normalizedDate = `${year}-${month}-${day}`;
                  }
                }

                const key = `${item.name}-${normalizedDate}`;
                if (!acc[key]) {
                  acc[key] = { ...item, date: normalizedDate, totalMs: 0, sessions: [] };
                }
                
                const existingIndex = acc[key].sessions.findIndex(s => s.timestamp === item.timestamp);
                if (existingIndex !== -1) {
                  if (item.signOut && !acc[key].sessions[existingIndex].signOut) {
                    acc[key].sessions[existingIndex] = item;
                  }
                } else {
                  acc[key].sessions.push(item);
                }
                
                return acc;
              }, {});

              const groupedArray = Object.values(grouped).map(group => {
                const totalMs = group.sessions.reduce((sum, s) => {
                  if (s.timestamp && s.signOutTimestamp) {
                    return sum + Math.max(0, new Date(s.signOutTimestamp) - new Date(s.timestamp));
                  }
                  return sum;
                }, 0);
                return { ...group, totalMs };
              });

              if (groupedArray.length > 0) {
                return groupedArray.map((group, index) => {
                  const totalSeconds = Math.floor(group.totalMs / 1000);
                  const h = Math.floor(totalSeconds / 3600);
                  const m = Math.floor((totalSeconds % 3600) / 60);
                  const s = totalSeconds % 60;
                  const totalDurationStr = `${h}h ${m}m ${s}s`;

                  // Find the earliest sign in and latest sign out for this person today
                  const sortedSessions = [...group.sessions].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
                  const firstIn = sortedSessions[0].signIn;
                  const lastSession = sortedSessions[sortedSessions.length - 1];
                  const lastOut = lastSession.signOut || 'Active';

                  return (
                    <tr key={index} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem', fontWeight: '600' }}>{group.name}</td>
                      <td style={{ padding: '1rem', color: 'var(--text-muted)' }}>{group.date}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className="login-time-badge" style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--success)' }}>
                          {firstIn}
                        </span>
                      </td>
                      <td style={{ padding: '1rem' }}>
                        {lastOut !== 'Active' ? (
                          <span className="login-time-badge" style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger)' }}>
                            {lastOut}
                          </span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>Active</span>
                        )}
                      </td>
                      <td style={{ padding: '1rem' }}>
                        <span className="login-time-badge" style={{ background: 'rgba(99, 102, 241, 0.1)', color: 'var(--primary)', minWidth: '100px', display: 'inline-block', textAlign: 'center' }}>
                          {totalDurationStr}
                        </span>
                      </td>
                    </tr>
                  );
                });
              } else {
                return (
                  <tr>
                    <td colSpan="5" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                      No attendance records found.
                    </td>
                  </tr>
                );
              }
            })()}
          </tbody>
        </table>
      </div>

    </div>
  );

  const renderEmployee = () => (
    <div className="employee-view">

      <div className="view-header">

        <button
          className="btn-back"
          onClick={() => setCurrentPage('home')}
        >
          <ArrowLeft size={18} />
          Back
        </button>

        <h2>Employee Attendance Portal</h2>

      </div>

      <div className="display-area">

        <div className="video-section">

          <div className="info-card">
            <div className="field-group">
              <label>Employee ID</label>
              <input
                type="text"
                placeholder="e.g. EMP123"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
              />
            </div>

            <div className="field-group">
              <label>Department</label>
              <select
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
              >
                <option value="">
                  Select Department
                </option>

                <option value="Staff">
                  Staff
                </option>

                <option value="Doctor">
                  Doctor
                </option>

              </select>
            </div>
          </div>

          <div className="controls">

            {!captureVideo ? (
              <button
                className="btn-primary"
                onClick={startVideo}
              >
                <Camera size={18} />
                Enable Camera
              </button>
            ) : (
              <button
                className="btn-back"
                onClick={closeVideo}
              >
                Stop Camera
              </button>
            )}

            <button
              className="btn-primary"
              style={{ background: 'green' }}
              onClick={handleSignIn}
            >
              Sign In
            </button>

            <button
              className="btn-primary"
              style={{ background: 'red' }}
              onClick={handleSignOut}
            >
              Sign Out
            </button>

          </div>

          <div className="video-wrapper">

            {captureVideo ? (
              <div className="video-container">

                <video
                  ref={videoRef}
                  onPlay={handleVideoOnPlay}
                  className="video-stream"
                />

                <canvas
                  ref={canvasRef}
                  className="overlay-canvas"
                />

              </div>
            ) : (
              <div className="placeholder">

                <Camera size={64} />
                <p>Camera inactive</p>

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );

  const handleLoginSubmit = () => {
    if (username === '1admin123' && password === 'qazwsx@123') {
      setIsLoggedIn(true);
      setCurrentPage('home');
      // Reset fields for security
      setUsername('');
      setPassword('');
    } else {
      alert('Invalid credentials. Please try again.');
    }
  };

  const renderLogin = () => (
    <div className="login-container" style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '70vh',
      padding: '2rem',
      paddingBottom: '15vh'
    }}>
      <div className="login-card" style={{
        background: 'var(--glass)',
        backdropFilter: 'blur(16px)',
        padding: '3rem',
        borderRadius: '32px',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        width: '100%',
        maxWidth: '400px',
        display: 'flex',
        flexDirection: 'column',
        gap: '2rem',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)'
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            background: 'rgba(56, 189, 248, 0.1)',
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            color: '#38bdf8'
          }}>
            <Activity size={32} />
          </div>
          <h2 style={{ fontSize: '1.75rem', fontWeight: '800', marginBottom: '0.5rem' }}>Welcome Back</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Please enter your credentials to continue</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="field-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLoginSubmit()}
            />
          </div>

          <div className="field-group">
            <label>Password</label>
            <input
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleLoginSubmit()}
            />
          </div>
        </div>

        <button
          className="btn-primary"
          onClick={handleLoginSubmit}
          style={{
            padding: '1rem',
            fontSize: '1rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            marginTop: '0.5rem'
          }}
        >
          Sign In
        </button>
      </div>
    </div>
  );

  return (
    <div className="app-container">

      <header
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}
      >

        <div className="logo-container">
          <Activity
            className="icon-header"
            size={20}
            color="#38bdf8"
          />

          <h1>RADIANT Clinic Attendance</h1>
        </div>

        {/* LOGOUT BUTTON */}
        {isLoggedIn && (
          <button
            className="btn-primary"
            onClick={handleLogout}
            style={{
              background: '#ef4444',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            <LogOut size={18} />
            Logout
          </button>
        )}

      </header>

      {error && (
        <div className="error-banner">
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      <main>

        {!isLoggedIn ? (
          renderLogin()
        ) : (
          <>
            {currentPage === 'home' && renderHome()}
            {currentPage === 'admin' && renderAdmin()}
            {currentPage === 'employee' && renderEmployee()}
            {currentPage === 'summary' && renderSummary()}
          </>
        )}

      </main>

      <footer>
        <p>
          © 2026 SmartAttendance System
        </p>
      </footer>

    </div>
  );
}

export default App;