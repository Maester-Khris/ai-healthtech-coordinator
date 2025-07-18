import type { Severity } from "../types";

export const cnTowerPos: [number, number] = [43.6426, -79.3871];
export const torontoCentre: [number, number] = [43.6532, -79.3832];

export const rank: Record<Severity, number> = {
  critical: 0,
  severe: 1,
  moderate: 2,
  routine: 3,
};

export const torontoHealthProviders: { name: string; position: [number, number]; type: string; }[] = [
    { name: "Toronto General Hospital (UHN)", position: [43.6575, -79.3875], type: "Hospital" },
    { name: "Mount Sinai Hospital",            position: [43.6573, -79.3888], type: "Hospital" },
    { name: "Hospital for Sick Children",      position: [43.6593, -79.3905], type: "Hospital" },
    { name: "St. Michael's Hospital (Unity Health)", position: [43.6527, -79.3757], type: "Hospital" },
    { name: "Sunnybrook Health Sciences Centre", position: [43.7128, -79.3762], type: "Hospital" },
    { name: "Women's College Hospital",        position: [43.6608, -79.3888], type: "Hospital" },
    { name: "Princess Margaret Cancer Centre (UHN)", position: [43.6568, -79.3879], type: "Hospital" },
    { name: "CAMH (Centre for Addiction and Mental Health - Queen St)", position: [43.6454, -79.4087], type: "Hospital (Mental Health & Addiction)" },
    { name: "Michael Garron Hospital",         position: [43.6934, -79.3082], type: "Hospital" },
    { name: "Humber River Hospital (Wilson Site)", position: [43.7196, -79.5229], type: "Hospital" },
    { name: "Toronto Western Hospital (UHN)", position: [43.6543, -79.4000], type: "Hospital" },
    { name: "St. Joseph's Health Centre (Unity Health)", position: [43.6366, -79.4533], type: "Hospital" },
    { name: "North York General Hospital (General Site)", position: [43.7565, -79.3742], type: "Hospital" },
    { name: "Scarborough Health Network - General Hospital", position: [43.7315, -79.2476], type: "Hospital" },
    { name: "Scarborough Health Network - Birchmount Hospital", position: [43.7915, -79.2942], type: "Hospital" },
    { name: "Scarborough Health Network - Centenary Hospital", position: [43.7844, -79.1672], type: "Hospital" },
    { name: "Providence Healthcare (Unity Health)", position: [43.6974, -79.2785], type: "Hospital (Rehabilitation & Complex Care)" },
    { name: "Baycrest Centre for Geriatric Care", position: [43.7310, -79.4440], type: "Hospital (Geriatric & Brain Health)" },
    { name: "Holland Bloorview Kids Rehabilitation Hospital", position: [43.7145, -79.3620], type: "Hospital (Pediatric Rehabilitation)" },
    { name: "Toronto Rehabilitation Institute (UHN - University Centre)", position: [43.6599, -79.3900], type: "Hospital (Rehabilitation)" },
    { name: "West Park Healthcare Centre", position: [43.6930, -79.5200], type: "Hospital (Rehabilitation & Complex Care)" },
    { name: "Toronto Grace Health Centre", position: [43.6669, -79.3820], type: "Hospital (Palliative Care & Complex Care)" },
    { name: "Bridgepoint Active Healthcare (Sinai Health)", position: [43.6705, -79.3565], type: "Hospital (Rehabilitation & Complex Care)" },
    { name: "Casey House", position: [43.6690, -79.3800], type: "Hospital (HIV/AIDS Care)" },
    { name: "Cleveland Clinic Canada (Downtown)", position: [43.6475, -79.3820], type: "Clinic (Multi-specialty)" },
    { name: "HealthOne Medical & Wellness Centre (The Well)", position: [43.6469, -79.3904], type: "Clinic (Multi-specialty)" },
    { name: "Appletree Medical Group (various locations, e.g., Yonge & Eglinton)", position: [43.7046, -79.3995], type: "Clinic (Walk-in & Family)" },
    { name: "Medcan Clinic", position: [43.6600, -79.3970], type: "Clinic (Executive Health & Wellness)" },
    { name: "University Health Network - Family Health Team (Kensington Health)", position: [43.6550, -79.3980], type: "Clinic (Family Health Team)" },
    { name: "South Riverdale Community Health Centre", position: [43.6600, -79.3390], type: "Community Health Centre" },
    { name: "Parkdale Queen West Community Health Centre", position: [43.6420, -79.4300], type: "Community Health Centre" },
    { name: "Regent Park Community Health Centre", position: [43.6570, -79.3650], type: "Community Health Centre" },
    { name: "LAMP Community Health Centre", position: [43.6060, -79.5050], type: "Community Health Centre" },
    { name: "Anishnawbe Health Toronto", position: [43.6450, -79.3600], type: "Community Health Centre (Indigenous-focused)" },
    { name: "Flemingdon Health Centre", position: [43.7220, -79.3300], type: "Community Health Centre" },
    { name: "Planned Parenthood Toronto", position: [43.6740, -79.3920], type: "Clinic (Sexual Health)" },
    { name: "The Medical Station (Yonge & St. Clair)", position: [43.6900, -79.3940], type: "Clinic (Family & Walk-in)" },
    { name: "Lifemark Health Group (multiple physiotherapy clinics)", position: [43.6500, -79.3800], type: "Clinic (Physiotherapy & Rehabilitation)" },
    { name: "Eye Care Centre (various locations, e.g., University Ave)", position: [43.6560, -79.3900], type: "Clinic (Optometry/Ophthalmology)" },
    { name: "Dentistry on University", position: [43.6555, -79.3865], type: "Clinic (Dental)" },
    { name: "Toronto Allergy & Asthma Clinic", position: [43.6750, -79.3950], type: "Clinic (Specialty)" },
    { name: "The Dermatology Centre", position: [43.6700, -79.3900], type: "Clinic (Dermatology)" },
    { name: "Integrative Health Centre (various locations)", position: [43.6600, -79.4000], type: "Clinic (Naturopathic/Integrative)" }
];