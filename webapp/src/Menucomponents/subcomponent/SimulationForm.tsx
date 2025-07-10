import { HandPalm, PlayCircle } from "@phosphor-icons/react";
import type { SimulationParams } from "../types";

import React, { useState } from "react";

export interface Props {
  isRunning: boolean;
  onLaunch: (cfg: SimulationParams) => void;
  onStop: () => void;
  peopleCount: number;       // NEW
  timeLeftMs: number;  
}
;

export const SimulationForm: React.FC<Props> = ({ isRunning, onLaunch, onStop, peopleCount,
  timeLeftMs, }) => {
  /* local controlled fields */
  const [durationMin, setDurationMin]     = useState(5);
  const [totalPeople, setTotalPeople]     = useState(30);
  const [maxIntervalSec, setMaxInterval]  = useState(8);

  const launch = () =>
    onLaunch({ durationMin, totalPeople, maxIntervalSec: maxIntervalSec });

  const mmss = new Date(timeLeftMs).toISOString().substring(14, 19); // "MM:SS"

  return (
      <div className="h-full flex flex-col p-8 rounded-xl bg-white shadow-xl dark:bg-slate-800"> {/* Adjusted padding and stronger shadow */}
        <form className="flex flex-col gap-4" onSubmit={e => { e.preventDefault(); launch(); }}> {/* Reduced gap for better flow */}
          {/* --- Duration ---- */}
          <FormRow
            id="duration"
            label="Simulation duration"
            value={durationMin}
            onChange={setDurationMin}
            unit="min"
          />
          {/* --- Max people ---- */}
          <FormRow
            id="max_people"
            label="Maximum people"
            value={totalPeople}
            onChange={setTotalPeople}
          />
          {/* --- Max interval ---- */}
          <FormRow
            id="max_interval"
            label="Max interval between waves"
            value={maxIntervalSec}
            onChange={setMaxInterval}
            unit="sec"
          />
        </form>
  
        <div className="mt-6 text-base text-slate-600 dark:text-slate-300 space-y-1"> {/* Increased font size and added spacing */}
            <div>
              <span className="font-bold">{peopleCount}</span> /{" "} {/* Made count bolder */}
              people generated
            </div>
            <div>
              Time left:&nbsp;
              <span className="font-mono font-bold">{mmss}</span> {/* Made time left bolder */}
            </div>
          </div>
  
        {/* start / stop buttons */}
        {!isRunning ? (
          <button
            onClick={launch}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-blue-600 px-8 py-3.5
                       text-xl font-semibold text-white transition hover:bg-blue-700 active:scale-95 shadow-lg hover:shadow-xl" // Brighter blue, larger text, more padding, shadow
          >
            <PlayCircle size={30} weight="bold" /> {/* Slightly larger icon */}
            Start simulation
          </button>
        ) : (
          <button
            onClick={onStop}
            className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-red-700 px-8 py-3.5
                       text-xl font-semibold text-white transition hover:bg-red-800 active:scale-95 shadow-lg hover:shadow-xl" // Darker red, larger text, more padding, shadow
          >
            <HandPalm size={28} weight="bold" /> {/* Slightly larger icon */}
            Stop simulation
          </button>
        )}
      </div>
    );
};


interface RowProps {
  id: string;
  label: string;
  value: number;
  onChange: (v: number) => void;
  unit?: string;
}
const FormRow: React.FC<RowProps> = ({ id, label, value, onChange, unit }) => (
  <div className="flex items-center justify-between py-2"> {/* Added vertical padding */}
    <label htmlFor={id} className="text-base font-semibold text-slate-700 dark:text-slate-200"> {/* Increased font size */}
      {label}
    </label>
    <div className="relative w-40">
      <input
        id={id}
        type="number"
        value={value}
        min={0}
        onChange={e => onChange(Number(e.target.value))}
        className="peer w-full rounded-md border border-slate-300 bg-white py-2.5 pl-3 pr-10 {/* Increased padding for height, left-aligned text */}
                   text-base text-slate-900 placeholder-slate-400 focus:border-blue-500 focus:ring-2
                   focus:ring-blue-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100 dark:focus:ring-blue-500" // Adjusted focus color
      />
      {unit && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
          {unit}
        </span>
      )}
    </div>
  </div>
);


/* small sub‑component so we don’t repeat markup */
// interface RowProps {
//   id: string;
//   label: string;
//   value: number;
//   onChange: (v: number) => void;
//   unit?: string;
// }
// const FormRow: React.FC<RowProps> = ({ id, label, value, onChange, unit }) => (
//   <div className="flex items-center justify-between">
//     <label htmlFor={id} className="text-[15px] max-w-[150px] font-semibold text-slate-700 dark:text-slate-200">
//       {label}
//     </label>
//     <div className="relative w-40">
//       <input
//         id={id}
//         type="number"
//         value={value}
//         min={0}
//         onChange={e => onChange(Number(e.target.value))}
//         className="peer w-full rounded-md border border-slate-300 bg-white py-2 pr-10 pl-3 text-right
//                    text-base text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:ring-2
//                    focus:ring-indigo-500 dark:border-slate-600 dark:bg-slate-700 dark:text-slate-100"
//       />
//       {unit && (
//         <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-slate-500 dark:text-slate-400">
//           {unit}
//         </span>
//       )}
//     </div>
//   </div>
// );

{/* 👇 live stats */}
       {/* {isRunning && (
        <div className="mt-6 text-sm text-slate-600 dark:text-slate-300">
          <div>
            <span className="font-semibold">{peopleCount}</span> /{" "}
            
            people generated
          </div>
          <div>
            Time left:&nbsp;
            <span className="font-mono">{mmss}</span>
          </div>
        </div>
      )} */}


    //   <div className="h-full flex flex-col p-10 rounded-xl bg-white shadow-lg dark:bg-slate-800">
    //   <form className="flex flex-col gap-5" onSubmit={e => { e.preventDefault(); launch(); }}>
    //     {/* --- Duration ---- */}
    //     <FormRow
    //       id="duration"
    //       label="Simulation duration"
    //       value={durationMin}
    //       onChange={setDurationMin}
    //       unit="min"
    //     />
    //     {/* --- Max people ---- */}
    //     <FormRow
    //       id="max_people"
    //       label="Maximum people"
    //       value={totalPeople}
    //       onChange={setTotalPeople}
    //     />
    //     {/* --- Max interval ---- */}
    //     <FormRow
    //       id="max_interval"
    //       label="Max interval between waves"
    //       value={maxIntervalSec}
    //       onChange={setMaxInterval}
    //       unit="sec"
    //     />
    //   </form>

    //   <div className="mt-6 text-sm text-slate-600 dark:text-slate-300">
    //       <div>
    //         <span className="font-semibold">{peopleCount}</span> /{" "}
    //         {/* you could also show cfg.totalPeople if you pass it down */}
    //         people generated
    //       </div>
    //       <div>
    //         Time left:&nbsp;
    //         <span className="font-mono">{mmss}</span>
    //       </div>
    //     </div>

    //   {/* start / stop buttons */}
    //   {!isRunning ? (
    //     <button
    //       onClick={launch}
    //       className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-[#0B4276] px-6 py-3
    //                  text-lg font-semibold text-white transition hover:bg-[#46A0B9] active:scale-95"
    //     >
    //       <PlayCircle size={28} weight="bold" />
    //       Launch simulation
    //     </button>
    //   ) : (
    //     <button
    //       onClick={onStop}
    //       className="mt-8 inline-flex items-center justify-center gap-2 rounded-md bg-red-600 px-6 py-3
    //                  text-lg font-semibold text-white transition hover:bg-red-700 active:scale-95"
    //     >
    //       <HandPalm size={26} weight="bold" />
    //       Stop simulation
    //     </button>
    //   )}
    // </div>