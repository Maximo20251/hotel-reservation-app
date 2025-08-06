import React, { useState, useEffect, useRef } from 'react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, collection, addDoc, doc, updateDoc, deleteDoc, query, onSnapshot, getDocs } from 'firebase/firestore';

// Global variables provided by the Canvas environment
const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
const firebaseConfig = typeof __firebase_config !== 'undefined' ? JSON.parse(__firebase_config) : {};
const initialAuthToken = typeof __initial_auth_token !== 'undefined' ? __initial_auth_token : null;

// Modal Component for displaying generated text or confirmations
const Modal = ({ children, onClose }) => {
    return (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex items-center justify-center p-4 z-50">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-lg relative">
                <button
                    onClick={onClose}
                    className="absolute top-3 right-3 text-gray-500 hover:text-gray-800 text-2xl font-bold"
                >
                    &times;
                </button>
                {children}
            </div>
        </div>
    );
};

function App() {
    const [db, setDb] = useState(null);
    const [auth, setAuth] = useState(null);
    const [userId, setUserId] = useState(null);
    const [reservations, setReservations] = useState([]);
    const [guestName, setGuestName] = useState('');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [reservationDate, setReservationDate] = useState('');
    const [totalFee, setTotalFee] = useState('');
    const [downpayment, setDownpayment] = useState('');
    const [reservationType, setReservationType] = useState('Day'); // Default to 'Day'
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [editingReservation, setEditingReservation] = useState(null);

    const [showSummaryModal, setShowSummaryModal] = useState(false);
    const [summaryContent, setSummaryContent] = useState('');
    const [generatingSummary, setGeneratingSummary] = useState(false);
    const [summaryError, setSummaryError] = useState(null);

    const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
    const [reservationToDeleteId, setReservationToDeleteId] = useState(null);

    const [showCopyConfirmModal, setShowCopyConfirmModal] = useState(false);
    const [copyMessage, setCopyMessage] = useState('');

    // Calendar state
    const [currentMonth, setCurrentMonth] = useState(new Date().getMonth());
    const [currentYear, setCurrentYear] = useState(new Date().getFullYear());

    // State for showing reservations for a specific day
    const [showDayReservationsModal, setShowDayReservationsModal] = useState(false);
    const [selectedDayForDetails, setSelectedDayForDetails] = useState(null);
    const [reservationsForSelectedDay, setReservationsForSelectedDay] = useState([]);

    // Ref to ensure sample data is added only once
    const hasSeededData = useRef(false);

    // Initialize Firebase and authenticate
    useEffect(() => {
        const app = initializeApp(firebaseConfig);
        const authInstance = getAuth(app);
        const firestoreInstance = getFirestore(app);

        setAuth(authInstance);
        setDb(firestoreInstance);

        const unsubscribe = onAuthStateChanged(authInstance, async (user) => {
            if (user) {
                setUserId(user.uid);
            } else {
                try {
                    if (initialAuthToken) {
                        await signInWithCustomToken(authInstance, initialAuthToken);
                    } else {
                        await signInAnonymously(authInstance);
                    }
                    setUserId(authInstance.currentUser?.uid || crypto.randomUUID());
                } catch (err) {
                    console.error("Firebase Auth Error:", err);
                    setError("Failed to authenticate. Please try again.");
                }
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Fetch reservations when DB and userId are ready
    useEffect(() => {
        if (db && userId) {
            const reservationsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/reservations`);
            const q = query(reservationsCollectionRef);

            const unsubscribe = onSnapshot(q, (snapshot) => {
                const fetchedReservations = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                }));
                setReservations(fetchedReservations);
            }, (err) => {
                console.error("Error fetching reservations:", err);
                setError("Failed to load reservations. Please try again.");
            });

            return () => unsubscribe();
        }
    }, [db, userId]);

    // Add sample data if no reservations exist (runs once after initial load)
    useEffect(() => {
        const addSampleData = async () => {
            if (db && userId && !hasSeededData.current) {
                const reservationsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/reservations`);
                const existingDocs = await getDocs(reservationsCollectionRef);
                if (existingDocs.empty) {
                    console.log("Adding sample data...");
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(today.getDate() + 1);
                    const dayAfterTomorrow = new Date(today);
                    dayAfterTomorrow.setDate(today.getDate() + 2);
                    const nextWeek = new Date(today);
                    nextWeek.setDate(today.getDate() + 7);

                    const sampleReservations = [
                        {
                            guestName: "Alice Smith",
                            phoneNumber: "12345678",
                            reservationDate: today.toISOString().split('T')[0],
                            totalFee: 250.00,
                            downpayment: 50.00,
                            reservationType: "Day_Night",
                            createdAt: new Date().toISOString()
                        },
                        {
                            guestName: "Bob Johnson",
                            phoneNumber: "87654321",
                            reservationDate: tomorrow.toISOString().split('T')[0],
                            totalFee: 150.00,
                            downpayment: 75.00,
                            reservationType: "Day",
                            createdAt: new Date().toISOString()
                        },
                        {
                            guestName: "Charlie Brown",
                            phoneNumber: "11223344",
                            reservationDate: tomorrow.toISOString().split('T')[0], // Same day as Bob, but Night
                            totalFee: 120.00,
                            downpayment: 60.00,
                            reservationType: "Night",
                            createdAt: new Date().toISOString()
                        },
                        {
                            guestName: "Diana Prince",
                            phoneNumber: "99887766",
                            reservationDate: dayAfterTomorrow.toISOString().split('T')[0],
                            totalFee: 300.00,
                            downpayment: 100.00,
                            reservationType: "Night",
                            createdAt: new Date().toISOString()
                        },
                        {
                            guestName: "Eve Adams",
                            phoneNumber: "55443322",
                            reservationDate: nextWeek.toISOString().split('T')[0],
                            totalFee: 200.00,
                            downpayment: 80.00,
                            reservationType: "Day",
                            createdAt: new Date().toISOString()
                        }
                    ];

                    for (const res of sampleReservations) {
                        await addDoc(reservationsCollectionRef, res);
                    }
                    hasSeededData.current = true; // Mark as seeded
                    console.log("Sample data added.");
                }
            }
        };

        if (db && userId && !loading) {
            addSampleData();
        }
    }, [db, userId, loading]);

    const handleAddOrUpdateReservation = async (e) => {
        e.preventDefault();
        setError(null);

        if (!guestName || !phoneNumber || !reservationDate || !totalFee || !downpayment || !reservationType) {
            setError("Please fill in all fields.");
            return;
        }
        // Basic phone number validation (8 digits only)
        if (!/^\d{8}$/.test(phoneNumber)) {
            setError("Phone number must be exactly 8 digits.");
            return;
        }

        const newReservation = {
            guestName,
            phoneNumber,
            reservationDate, // Stored as YYYY-MM-DD
            totalFee: parseFloat(totalFee),
            downpayment: parseFloat(downpayment),
            reservationType, // New field
            createdAt: new Date().toISOString()
        };

        try {
            if (editingReservation) {
                const reservationRef = doc(db, `artifacts/${appId}/users/${userId}/reservations`, editingReservation.id);
                await updateDoc(reservationRef, newReservation);
                setEditingReservation(null);
            } else {
                const reservationsCollectionRef = collection(db, `artifacts/${appId}/users/${userId}/reservations`);
                await addDoc(reservationsCollectionRef, newReservation);
            }
            // Clear form fields
            setGuestName('');
            setPhoneNumber('');
            setReservationDate('');
            setTotalFee('');
            setDownpayment('');
            setReservationType('Day'); // Reset to default
        } catch (err) {
            console.error("Error adding/updating reservation:", err);
            setError("Failed to save reservation. Please try again.");
        }
    };

    const handleEditClick = (reservation) => {
        setEditingReservation(reservation);
        setGuestName(reservation.guestName);
        setPhoneNumber(reservation.phoneNumber);
        setReservationDate(reservation.reservationDate);
        setTotalFee(reservation.totalFee.toString());
        setDownpayment(reservation.downpayment.toString());
        setReservationType(reservation.reservationType || 'Day'); // Set default if not present
    };

    const handleDeleteReservationConfirm = async () => {
        setError(null);
        if (reservationToDeleteId) {
            try {
                const reservationRef = doc(db, `artifacts/${appId}/users/${userId}/reservations`, reservationToDeleteId);
                await deleteDoc(reservationRef);
                setReservationToDeleteId(null);
                setShowDeleteConfirmModal(false);
            } catch (err) {
                console.error("Error deleting reservation:", err);
                setError("Failed to delete reservation. Please try again.");
            }
        }
    };

    const handleDeleteClick = (id) => {
        setReservationToDeleteId(id);
        setShowDeleteConfirmModal(true);
    };

    const generateReservationSummary = async (reservation) => {
        setGeneratingSummary(true);
        setSummaryError(null);
        setSummaryContent('');
        setShowSummaryModal(true);

        const prompt = `Generate a concise, friendly, and professional confirmation message for a hotel reservation. Include the following details: Guest Name: ${reservation.guestName}, Phone Number: ${reservation.phoneNumber}, Reservation Date: ${reservation.reservationDate}, Total Fee: $${reservation.totalFee.toFixed(2)}, Downpayment: $${reservation.downpayment.toFixed(2)}, Reservation Type: ${reservation.reservationType}. Also, add a polite reminder that the remaining balance is due upon check-in. Keep it under 100 words.`;

        let chatHistory = [];
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });

        const payload = { contents: chatHistory };
        const apiKey = ""; // Canvas will provide this at runtime
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-05-20:generateContent?key=${apiKey}`;

        try {
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(`API Error: ${response.status} - ${errorData.error?.message || response.statusText}`);
            }

            const result = await response.json();
            if (result.candidates && result.candidates.length > 0 &&
                result.candidates[0].content && result.candidates[0].content.parts &&
                result.candidates[0].content.parts.length > 0) {
                const text = result.candidates[0].content.parts[0].text;
                setSummaryContent(text);
            } else {
                setSummaryError("Could not generate summary. Unexpected API response.");
            }
        } catch (err) {
            console.error("Error generating summary:", err);
            setSummaryError(`Failed to generate summary: ${err.message}`);
        } finally {
            setGeneratingSummary(false);
        }
    };

    const copySummaryToClipboard = () => {
        if (summaryContent) {
            const textarea = document.createElement('textarea');
            textarea.value = summaryContent;
            document.body.appendChild(textarea);
            textarea.select();
            try {
                document.execCommand('copy');
                setCopyMessage('Summary copied to clipboard!');
            } catch (err) {
                console.error('Failed to copy text: ', err);
                setCopyMessage('Failed to copy summary.');
            }
            document.body.removeChild(textarea);
            setShowCopyConfirmModal(true);
        }
    };

    // Calendar Logic
    const getDaysInMonth = (year, month) => {
        return new Date(year, month + 1, 0).getDate();
    };

    const getFirstDayOfMonth = (year, month) => {
        return new Date(year, month, 1).getDay(); // 0 for Sunday, 1 for Monday, etc.
    };

    const daysInCurrentMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDayOffset = getFirstDayOfMonth(currentYear, currentMonth); // Number of empty cells before the 1st day

    const monthNames = ["January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const goToPreviousMonth = () => {
        setCurrentMonth(prevMonth => (prevMonth === 0 ? 11 : prevMonth - 1));
        setCurrentYear(prevYear => (currentMonth === 0 ? prevYear - 1 : prevYear));
    };

    const goToNextMonth = () => {
        setCurrentMonth(prevMonth => (prevMonth === 11 ? 0 : prevMonth + 1));
        setCurrentYear(prevYear => (currentMonth === 11 ? prevYear + 1 : prevYear));
    };

    // Determines the background color/gradient for a calendar cell based on reservation types
    const getCalendarCellBackground = (dayReservations) => {
        const hasDay = dayReservations.some(res => res.reservationType === 'Day');
        const hasNight = dayReservations.some(res => res.reservationType === 'Night');
        const hasDayNight = dayReservations.some(res => res.reservationType === 'Day_Night');

        // Highest priority: Day_Night (whole cell blue)
        if (hasDayNight) {
            return 'bg-blue-500';
        }

        // Next priority: Combination of Day and Night
        if (hasDay && hasNight) {
            return 'bg-gradient-day-and-night-split'; // Green top, Red bottom
        }

        // Individual types
        if (hasDay) {
            return 'bg-gradient-day-only-green'; // Green top, white bottom
        }
        if (hasNight) {
            return 'bg-gradient-night-only-red'; // Red bottom, white top
        }

        return 'bg-white'; // Default white
    };

    const exportReservationsToCsv = () => {
        if (reservations.length === 0) {
            setCopyMessage("No reservations to export.");
            setShowCopyConfirmModal(true);
            return;
        }

        const headers = ["ID", "Guest Name", "Phone Number", "Reservation Date", "Total Fee", "Downpayment", "Remaining Payment", "Reservation Type", "Created At"];
        const csvRows = [
            headers.join(',')
        ];

        reservations.forEach(res => {
            const remainingPayment = (res.totalFee - res.downpayment).toFixed(2);
            const row = [
                `"${res.id}"`,
                `"${res.guestName.replace(/"/g, '""')}"`,
                `"${res.phoneNumber}"`, // Keep full number for export
                `"${res.reservationDate}"`,
                res.totalFee.toFixed(2),
                res.downpayment.toFixed(2),
                remainingPayment,
                `"${res.reservationType}"`,
                `"${res.createdAt}"`
            ];
            csvRows.push(row.join(','));
        });

        const csvString = csvRows.join('\n');
        const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.setAttribute('download', 'hotel_reservations.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    };

    // Mask phone number for display only: **/******
    const maskedPhoneNumberDisplay = (num) => {
        if (!num || num.length !== 8) return 'Invalid #';
        // Format as XX/XXXXXX
        return `${num.substring(0,2)}/${num.substring(2)}`;
    };

    // Handle click on a calendar day cell
    const handleDayCellClick = (date) => {
        const reservationsForDay = reservations.filter(res => res.reservationDate === date);
        setSelectedDayForDetails(date);
        setReservationsForSelectedDay(reservationsForDay);
        setShowDayReservationsModal(true);
    };

    // Function to pre-fill form when adding from day modal
    const handleAddReservationFromModal = (date) => {
        setEditingReservation(null); // Ensure we are adding, not editing
        setGuestName('');
        setPhoneNumber('');
        setReservationDate(date); // Pre-fill date
        setTotalFee('');
        setDownpayment('');
        setReservationType('Day'); // Reset to default
        setShowDayReservationsModal(false); // Close modal
        // Optionally scroll to form or highlight it
        document.getElementById('guestName').focus(); // Focus on the first input
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-100">
                <div className="text-xl font-semibold text-gray-700">Loading app...</div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4 sm:p-6 lg:p-8 font-inter">
            <script src="https://cdn.tailwindcss.com"></script>
            <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />

            <style>
                {`
                body {
                    font-family: 'Inter', sans-serif;
                }
                input[type="date"]::-webkit-calendar-picker-indicator {
                    filter: invert(0.5) sepia(1) saturate(5) hue-rotate(175deg); /* Adjust color to match theme */
                }
                .calendar-grid {
                    display: grid;
                    grid-template-columns: repeat(7, 1fr);
                    gap: 4px;
                }
                .day-cell {
                    min-height: 120px; /* Increased height for more content */
                    border: 1px solid #e2e8f0;
                    border-radius: 8px;
                    padding: 8px;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-start;
                    overflow: hidden;
                    cursor: pointer; /* Indicate clickability */
                    position: relative; /* For gradient backgrounds */
                    transition: transform 0.1s ease-in-out, box-shadow 0.1s ease-in-out;
                }
                .day-cell:hover {
                    transform: translateY(-2px);
                    box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
                }
                .day-number {
                    font-weight: 600;
                    margin-bottom: 4px;
                    color: #4a5568;
                    z-index: 1; /* Ensure day number is on top of background */
                    position: relative;
                }
                .reservation-tag {
                    font-size: 0.7rem; /* Smaller font for tags */
                    padding: 2px 6px;
                    border-radius: 4px;
                    color: white;
                    margin-bottom: 2px;
                    width: 100%;
                    text-align: left;
                    overflow: hidden;
                    white-space: nowrap;
                    text-overflow: ellipsis;
                    z-index: 1; /* Ensure tags are on top of background */
                    position: relative;
                    box-shadow: 0 1px 2px rgba(0,0,0,0.1);
                }
                /* Custom gradient classes for calendar cells */
                .bg-gradient-day-only-green {
                    background: linear-gradient(to bottom, #34d399 50%, #ffffff 50%); /* Green top, white bottom (for Day) */
                }
                .bg-gradient-night-only-red {
                    background: linear-gradient(to top, #ef4444 50%, #ffffff 50%); /* Red bottom, white top (for Night) */
                }
                .bg-gradient-day-and-night-split {
                    background: linear-gradient(to bottom, #34d399 50%, #ef4444 50%); /* Green top, Red bottom (for Day & Night combo) */
                }
                `}
            </style>

            <div className="max-w-6xl mx-auto bg-white rounded-xl shadow-2xl p-6 sm:p-8 lg:p-10">
                <h1 className="text-3xl sm:text-4xl font-bold text-center text-indigo-700 mb-8">
                    Hotel Reservation Manager
                </h1>

                {userId && (
                    <div className="text-sm text-gray-600 text-center mb-6 p-3 bg-gray-50 rounded-lg border border-gray-200">
                        Your User ID: <span className="font-mono break-all text-indigo-600">{userId}</span>
                    </div>
                )}

                {error && (
                    <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" role="alert">
                        <strong className="font-bold">Error!</strong>
                        <span className="block sm:inline ml-2">{error}</span>
                    </div>
                )}

                {/* Reservation Form */}
                <form onSubmit={handleAddOrUpdateReservation} className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10 p-6 bg-blue-50 rounded-lg shadow-inner">
                    <div className="col-span-1">
                        <label htmlFor="guestName" className="block text-sm font-medium text-gray-700 mb-1">Guest Name</label>
                        <input
                            type="text"
                            id="guestName"
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={guestName}
                            onChange={(e) => setGuestName(e.target.value)}
                            placeholder="John Doe"
                            required
                        />
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="phoneNumber" className="block text-sm font-medium text-gray-700 mb-1">Phone Number (8 digits)</label>
                        <input
                            type="text" // Changed to text to better control input
                            id="phoneNumber"
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={phoneNumber}
                            onChange={(e) => setPhoneNumber(e.target.value.replace(/\D/g, '').slice(0, 8))} // Allow only digits, max 8
                            placeholder="12345678"
                            maxLength="8"
                            required
                        />
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="reservationDate" className="block text-sm font-medium text-gray-700 mb-1">Reservation Date</label>
                        <input
                            type="date"
                            id="reservationDate"
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={reservationDate}
                            onChange={(e) => setReservationDate(e.target.value)}
                            required
                        />
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="reservationType" className="block text-sm font-medium text-gray-700 mb-1">Reservation Type</label>
                        <select
                            id="reservationType"
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={reservationType}
                            onChange={(e) => setReservationType(e.target.value)}
                            required
                        >
                            <option value="Day">Day</option>
                            <option value="Night">Night</option>
                            <option value="Day_Night">Day-Night</option>
                        </select>
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="totalFee" className="block text-sm font-medium text-gray-700 mb-1">Total Fee ($)</label>
                        <input
                            type="number"
                            id="totalFee"
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={totalFee}
                            onChange={(e) => setTotalFee(e.target.value)}
                            placeholder="500.00"
                            step="0.01"
                            required
                        />
                    </div>
                    <div className="col-span-1">
                        <label htmlFor="downpayment" className="block text-sm font-medium text-gray-700 mb-1">Downpayment ($)</label>
                        <input
                            type="number"
                            id="downpayment"
                            className="mt-1 block w-full px-4 py-2 border border-gray-300 rounded-md shadow-sm focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                            value={downpayment}
                            onChange={(e) => setDownpayment(e.target.value)}
                            placeholder="100.00"
                            step="0.01"
                            required
                        />
                        {totalFee && downpayment && (
                            <p className="mt-2 text-sm text-gray-600">
                                Remaining: <span className="font-semibold text-indigo-700">${(parseFloat(totalFee) - parseFloat(downpayment)).toFixed(2)}</span>
                            </p>
                        )}
                    </div>
                    <div className="col-span-full flex justify-end mt-4">
                        <button
                            type="submit"
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out transform hover:scale-105"
                        >
                            {editingReservation ? 'Update Reservation' : 'Add Reservation'}
                        </button>
                        {editingReservation && (
                            <button
                                type="button"
                                onClick={() => {
                                    setEditingReservation(null);
                                    setGuestName('');
                                    setPhoneNumber('');
                                    setReservationDate('');
                                    setTotalFee('');
                                    setDownpayment('');
                                    setReservationType('Day');
                                }}
                                className="ml-3 inline-flex items-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition duration-150 ease-in-out transform hover:scale-105"
                            >
                                Cancel Edit
                            </button>
                        )}
                    </div>
                </form>

                {/* Calendar View */}
                <h2 className="text-2xl sm:text-3xl font-bold text-indigo-700 mb-6 text-center">
                    Reservations Calendar
                </h2>

                <div className="flex justify-between items-center mb-6">
                    <button
                        onClick={goToPreviousMonth}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-150 ease-in-out"
                    >
                        Previous
                    </button>
                    <h3 className="text-xl sm:text-2xl font-semibold text-gray-800">
                        {monthNames[currentMonth]} {currentYear}
                    </h3>
                    <button
                        onClick={goToNextMonth}
                        className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-400 transition duration-150 ease-in-out"
                    >
                        Next
                    </button>
                </div>

                <div className="calendar-grid mb-8">
                    {dayNames.map(day => (
                        <div key={day} className="text-center font-bold text-gray-700 py-2 border-b-2 border-indigo-200">
                            {day}
                        </div>
                    ))}
                    {Array.from({ length: firstDayOffset }).map((_, i) => (
                        <div key={`empty-${i}`} className="day-cell bg-gray-50"></div>
                    ))}
                    {Array.from({ length: daysInCurrentMonth }).map((_, i) => {
                        const day = i + 1;
                        const fullDate = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
                        const dayReservations = reservations.filter(res => res.reservationDate === fullDate);

                        return (
                            <div
                                key={day}
                                className={`day-cell ${getCalendarCellBackground(dayReservations)}`}
                                onClick={() => handleDayCellClick(fullDate)}
                            >
                                <span className="day-number">{day}</span>
                                {/* Preview the first few reservations on the calendar cell */}
                                {dayReservations.slice(0, 2).map(res => ( // Show up to 2 reservations directly
                                    <div
                                        key={res.id}
                                        className="reservation-tag"
                                        // The background color of the tag itself is based on its type
                                        style={{ backgroundColor: res.reservationType === 'Day' ? 'rgba(52, 211, 153, 0.8)' : res.reservationType === 'Night' ? 'rgba(239, 68, 68, 0.8)' : 'rgba(96, 165, 250, 0.8)' }}
                                        title={`Guest: ${res.guestName}, Paid: $${res.downpayment.toFixed(2)}, Rem: $${(res.totalFee - res.downpayment).toFixed(2)}`}
                                    >
                                        {res.guestName}
                                    </div>
                                ))}
                                {dayReservations.length > 2 && (
                                    <div className="reservation-tag bg-gray-300 text-gray-700"
                                        onClick={(e) => { e.stopPropagation(); handleDayCellClick(fullDate); }} // Prevent parent click
                                    >
                                        +{dayReservations.length - 2} more...
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                <div className="flex justify-center mt-8">
                    <button
                        onClick={exportReservationsToCsv}
                        className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out transform hover:scale-105"
                    >
                        Download Reservations (CSV)
                    </button>
                </div>
            </div>

            {/* Summary Modal */}
            {showSummaryModal && (
                <Modal onClose={() => setShowSummaryModal(false)}>
                    <h3 className="text-2xl font-bold text-indigo-700 mb-4">Reservation Summary</h3>
                    {generatingSummary ? (
                        <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500"></div>
                            <p className="ml-4 text-gray-700">Generating summary...</p>
                        </div>
                    ) : summaryError ? (
                        <p className="text-red-600">{summaryError}</p>
                    ) : (
                        <>
                            <p className="text-gray-800 mb-4 whitespace-pre-wrap">{summaryContent}</p>
                            <button
                                onClick={copySummaryToClipboard}
                                className="px-4 py-2 bg-green-500 text-white rounded-md shadow-sm hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 transition duration-150 ease-in-out"
                            >
                                Copy to Clipboard
                            </button>
                        </>
                    )}
                </Modal>
            )}

            {/* Delete Confirmation Modal */}
            {showDeleteConfirmModal && (
                <Modal onClose={() => setShowDeleteConfirmModal(false)}>
                    <h3 className="text-2xl font-bold text-red-700 mb-4">Confirm Deletion</h3>
                    <p className="text-gray-800 mb-6">Are you sure you want to delete this reservation? This action cannot be undone.</p>
                    <div className="flex justify-end space-x-3">
                        <button
                            onClick={() => setShowDeleteConfirmModal(false)}
                            className="px-4 py-2 bg-gray-300 text-gray-800 rounded-md shadow-sm hover:bg-gray-400 transition duration-150 ease-in-out"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleDeleteReservationConfirm}
                            className="px-4 py-2 bg-red-600 text-white rounded-md shadow-sm hover:bg-red-700 transition duration-150 ease-in-out"
                        >
                            Delete
                        </button>
                    </div>
                </Modal>
            )}

            {/* Copy Confirmation Modal */}
            {showCopyConfirmModal && (
                <Modal onClose={() => setShowCopyConfirmModal(false)}>
                    <h3 className="text-xl font-bold text-gray-800 mb-4">Copy Status</h3>
                    <p className="text-gray-700">{copyMessage}</p>
                    <div className="flex justify-end mt-6">
                        <button
                            onClick={() => setShowCopyConfirmModal(false)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 transition"
                        >
                            Close
                        </button>
                    </div>
                </Modal>
            )}

            {/* Day Reservations Details Modal */}
            {showDayReservationsModal && (
                <Modal onClose={() => setShowDayReservationsModal(false)}>
                    <h3 className="text-2xl font-bold text-indigo-700 mb-4">Reservations for {selectedDayForDetails}</h3>
                    {reservationsForSelectedDay.length === 0 ? (
                        <p className="text-gray-600 mb-4">No reservations for this day.</p>
                    ) : (
                        <div className="space-y-4 max-h-80 overflow-y-auto pr-2">
                            {reservationsForSelectedDay.map(res => (
                                <div key={res.id} className="bg-gray-50 p-3 rounded-lg border border-gray-200 shadow-sm">
                                    <p className="text-lg font-semibold text-gray-800">Guest: {res.guestName}</p>
                                    <p className="text-sm text-gray-600">Phone: {maskedPhoneNumberDisplay(res.phoneNumber)}</p>
                                    <p className="text-sm text-gray-600">Type: <span className={`font-medium ${res.reservationType === 'Day' ? 'text-green-600' : res.reservationType === 'Night' ? 'text-red-600' : 'text-blue-600'}`}>{res.reservationType}</span></p>
                                    <p className="text-sm text-gray-600">Paid: ${res.downpayment.toFixed(2)}</p>
                                    <p className="text-sm text-gray-600">Remaining: ${(res.totalFee - res.downpayment).toFixed(2)}</p>
                                    <div className="flex flex-wrap gap-2 mt-3">
                                        <button
                                            onClick={() => {
                                                handleEditClick(res);
                                                setShowDayReservationsModal(false); // Close day modal when editing
                                            }}
                                            className="px-3 py-1 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600 transition"
                                        >
                                            Edit
                                        </button>
                                        <button
                                            onClick={() => {
                                                setReservationToDeleteId(res.id);
                                                setShowDeleteConfirmModal(true);
                                                setShowDayReservationsModal(false); // Close day modal
                                            }}
                                            className="px-3 py-1 text-sm bg-red-500 text-white rounded-md hover:bg-red-600 transition"
                                        >
                                            Delete
                                        </button>
                                        <button
                                            onClick={() => {
                                                generateReservationSummary(res);
                                                setShowDayReservationsModal(false); // Close day modal
                                            }}
                                            className="px-3 py-1 text-sm bg-purple-600 text-white rounded-md hover:bg-purple-700 transition"
                                        >
                                            Generate Summary ✨
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    <div className="mt-6 flex justify-end">
                        <button
                            onClick={() => handleAddReservationFromModal(selectedDayForDetails)}
                            className="px-4 py-2 bg-indigo-600 text-white rounded-md shadow-sm hover:bg-indigo-700 transition"
                        >
                            Add New Reservation for {selectedDayForDetails}
                        </button>
                    </div>
                </Modal>
            )}
        </div>
    );
}

export default App;
