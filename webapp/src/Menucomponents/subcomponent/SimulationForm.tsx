import React, { useEffect, useRef, useState } from "react";
import type { SimulationParams } from "../types";

export interface Props {
  isRunning: boolean;
  onLaunch: (cfg: SimulationParams) => void;
  onStop: () => void;
  peopleCount: number;       
  timeLeftMs: number;
}


export const SimulationForm: React.FC<Props> = ({ isRunning, onLaunch, onStop, peopleCount,
  timeLeftMs, }) => {
  /* local controlled fields */
  const [durationMin, setDurationMin] = useState(5);
  const [totalPeople, setTotalPeople] = useState(0);
  const [maxIntervalSec, setMaxInterval] = useState(8);
  const initialDurationMsRef = useRef(0);

  useEffect(() => {
    if (!isRunning && timeLeftMs === 0) {
      initialDurationMsRef.current = 0;
    } else if (isRunning && initialDurationMsRef.current === 0) {
      initialDurationMsRef.current = timeLeftMs > 0 ? timeLeftMs : (durationMin * 60 * 1000);
    }
  }, [isRunning, timeLeftMs, durationMin]);

  const toggleSimulator = () => {
    console.log(isRunning);
    if (isRunning) {
      onStop();
    } else {
      onLaunch({
        durationMin: durationMin,
        maxIntervalSec: maxIntervalSec,
        totalPeople: totalPeople,
      });
    }
  }

  // Format elapsed time for display
  const formatTime = (totalMs: number) => {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000)); // Ensure non-negative
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };
  const initialDurationMs = initialDurationMsRef.current;
  const elapsedMs = initialDurationMs > 0 ? (initialDurationMs - timeLeftMs) : 0;
  const progressPercentage = initialDurationMs > 0 ? (elapsedMs / initialDurationMs) * 100 : 0;
  const peopleProgressPercentage = totalPeople > 0 ? (peopleCount / totalPeople) * 100 : 0;


  return (
    <div className="h-full bg-gray-100 rounded-xl shadow-2xl p-8 pt-6 w-full max-w-md border-t-4 border-indigo-600">
      <h2 className="text-md font-extrabold text-gray-900 text-center mb-4">
        🚀  <br /> Simulator Control
      </h2>

      <div className="space-y-6">
        <div>
          <label htmlFor="minutes" className="block text-sm font-medium text-gray-700 mb-1">
            Duration (in minutes)
          </label>
          <input
            type="number"
            id="minutes"
            value={durationMin}
            onChange={(e) => setDurationMin(Number(e.target.value))}
            min="1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
            disabled={isRunning}
          />
        </div>
        <div>
          <label htmlFor="maxInterval" className="block text-sm font-medium text-gray-700 mb-1">
            Max wave interval (in seconds)
          </label>
          <input
            type="number"
            id="maxInterval"
            value={maxIntervalSec}
            onChange={(e) => setMaxInterval(Number(e.target.value))}
            min="1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
            disabled={isRunning}
          />
        </div>
        <div>
          <label htmlFor="maxResources" className="block text-sm font-medium text-gray-700 mb-1">
            Max people to add
          </label>
          <input
            type="number"
            id="maxResources"
            value={totalPeople}
            onChange={(e) => setTotalPeople(Number(e.target.value))}
            min="1"
            className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm transition duration-150 ease-in-out"
            disabled={isRunning}
          />
        </div>

        {/* Start/Stop Button */}
        <button
          onClick={toggleSimulator}
          className={`w-full flex justify-center py-2 px-4 border border-transparent font-semibold rounded-md shadow-lg transition duration-300 ease-in-out ${isRunning
              ? 'bg-red-600 hover:bg-red-700 focus:ring-red-500 text-white'
              : 'bg-green-600 hover:bg-green-700 focus:ring-green-500 text-white'
            } focus:outline-none focus:ring-2 focus:ring-offset-2`}
        >
          {isRunning ? 'Stop Simulator' : 'Start Simulator'}
        </button>

        {/* Visual Indicators */}
        <div className="mt-4 pt-4 border-t-2 border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-2 text-center">
          <div className="bg-indigo-50 p-3 rounded-lg shadow-inner">
            <p className="text-sm font-medium text-indigo-700">Time Remaining</p>
            <p className="font-bold text-indigo-900 mt-1">
              {formatTime(timeLeftMs)}
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-indigo-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercentage}%` }}
              ></div>
            </div>
          </div>
          <div className="bg-green-50 p-3 rounded-lg shadow-inner">
            <p className="text-sm font-medium text-green-700">Count People Added</p>
            <p className="font-bold text-green-900 mt-1">
              {peopleCount} <span className="font-normal">/ {totalPeople}</span>
            </p>
            <div className="w-full bg-gray-200 rounded-full h-2 mt-3">
              <div
                className="bg-green-500 h-2 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${peopleProgressPercentage}%` }}
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
