import { MapContainer } from './map/MapContainer'
import { Dashboard } from './components/Dashboard'
import { StatusBar } from './components/StatusBar'
import { SettingsPanel } from './components/SettingsPanel'
import { CoordManager } from './components/CoordManager'

export default function App() {
  return (
    <div className="relative h-full w-full overflow-hidden bg-tactical-bg text-slate-200">
      <MapContainer />
      <StatusBar />
      <SettingsPanel />
      <CoordManager />
      <Dashboard />
    </div>
  )
}
