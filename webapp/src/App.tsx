import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'

import './App.css'
import appLogo from './assets/finbotv2.png'
import Map from './Menucomponents/Map'
import Home from './Menucomponents/Home'
import Inhousescheduler from './Menucomponents/Inhousescheduler'

function App() {
  return (
    <BrowserRouter>
      <main className='mb-2'>
        <header className='main-content'>
          <div className='header-content'>
            <div className='header-content-left'>
              <img className='header-app-logo' src={appLogo} alt="fin logo" style={{height:'70px',width:'70px',}} />
              <div className='header-app'>
                <h3 className='header-appname'>AI Health System Coordinator</h3>
                <p>Your AI-Powered coordinator to health service provider</p>
              </div>
            </div>
            <div className='header-content-right'>
              <div className='header-menu'>
              <li><NavLink to="/" className={({isActive}) => isActive ? "active-link": ""}>Smart Routing</NavLink></li>
              <li><NavLink to="/scheduling" className={({isActive}) => isActive ? "active-link": ""}>In-house scheduling</NavLink></li>
              <li><NavLink to="/analytics" className={({isActive}) => isActive ? "active-link": ""}>Predictive Analysis</NavLink></li>
              </div>
            </div>
          </div>
        </header>
        <section className='main-content section-hero-home' style={{backgroundColor:"transparent"}}>
          <Routes>
            <Route path="/" element={<Home />}></Route>
            <Route path="/scheduling" element={<Inhousescheduler />}></Route>
            <Route path="/analytics" element={<Map />}></Route>
          </Routes>
        </section>
      </main>
    </BrowserRouter>


  )
}

export default App;