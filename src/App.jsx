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
        const response = await fetch('http://localhost:5000/api/attendance');
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

    const date = now.toLocaleDateString();
    const timestamp = now.toISOString();

    const isDuplicate = attendance.some(item =>
      item.name === name &&
      Math.abs(now - new Date(item.timestamp)) < 5000
    );

    if (isDuplicate && type === "Sign In") {
      return;
    }

    setAttendance(prev => {
      let updated = [...prev];

      const activeSessionIndex = updated.findIndex(item =>
        item.name === name &&
        item.date === date &&
        !item.signOut
      );

      if (type === "Sign Out") {
        if (activeSessionIndex !== -1) {
          const session = updated[activeSessionIndex];

          const duration = calculateDuration(
            session.timestamp,
            timestamp
          );

          updated[activeSessionIndex] = {
            ...session,
            signOut: time,
            signOutTimestamp: timestamp,
            duration
          };

          syncWithBackend(updated[activeSessionIndex], "update");

          return updated;
        }

        return prev;
      }

      if (activeSessionIndex !== -1) {
        return prev;
      }

      const newEntry = {
        name,
        date,
        signIn: time,
        timestamp,
        signOut: null,
        duration: 'N/A'
      };

      syncWithBackend(newEntry, "new");

      return [newEntry, ...prev];
    });
  };

  const syncWithBackend = async (data, mode) => {
    try {
      await fetch('http://localhost:5000/api/attendance', {
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
              {filteredAttendance.map((item, index) => (
                <tr key={index}>
                  <td>{item.name}</td>
                  <td>{item.date}</td>
                  <td>{item.signIn}</td>
                  <td>{item.signOut || 'Active'}</td>
                  <td>
                    {item.signOut
                      ? calculateDuration(
                        item.timestamp,
                        item.signOutTimestamp
                      )
                      : 'Pending'}
                  </td>
                </tr>
              ))}
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

      <div className="attendance-panel">

        {attendance.map((item, index) => (
          <div
            key={index}
            className="attendance-item"
          >
            <p><strong>{item.name}</strong></p>
            <p>{item.date}</p>
            <p>In: {item.signIn}</p>
            <p>Out: {item.signOut || 'Active'}</p>
          </div>
        ))}

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

            <input
              type="text"
              placeholder="Employee ID"
              value={employeeId}
              onChange={(e) => setEmployeeId(e.target.value)}
            />

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

  const renderLogin = () => (
    <div
      className="login-view"
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '1rem',
        marginTop: '4rem'
      }}
    >

      <h2>Login</h2>

      <input
        type="text"
        placeholder="Username"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
      />

      <input
        type="password"
        placeholder="Password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
      />

      <button
        className="btn-primary"
        onClick={() => {
          if (
            username === '1admin123' &&
            password === 'qazwsx@123'
          ) {
            setIsLoggedIn(true);
            setCurrentPage('home');
          } else {
            alert('Invalid credentials');
          }
        }}
      >
        Login
      </button>

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