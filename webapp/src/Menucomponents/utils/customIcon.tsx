import L from "leaflet";
import { renderToStaticMarkup } from "react-dom/server";
//import { Person } from "@phosphor-icons/react";
import CNTower from "../../assets/cn-tower.png";
import HospitalIc from "../../assets/hospital_6395229.png";
import { FaPerson } from "react-icons/fa6";

export const buildDivIcon = (element: React.ReactElement) =>
  L.divIcon({
    html: renderToStaticMarkup(element),
    className: "",                // remove Leaflet default styles
    iconSize: [28, 28],
    iconAnchor: [14, 28],
    popupAnchor: [0, -28],
  });

  {/* <Person size={32} weight="bold" style={{ color: "#097969" }} /> */}
export const peopleIcon   = buildDivIcon(
  <FaPerson size={32} style={{ color: "#097969" }}/>
);
export const CNTowerIcon  = buildDivIcon(<img src={CNTower}   style={{ width: 60, height: 60 }}  />);
export const HospitalIcon = buildDivIcon(<img src={HospitalIc} style={{ width: 40, height: 40 }}  />);
