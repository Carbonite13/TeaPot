import GradientASCII from './components/GradientASCII'
import NetworkSliceRecommender from './components/NetworkSliceRecommender'
import './App.css'

function App() {
  return (
    <>
      <div className="ascii-background" aria-hidden="true">
        <GradientASCII
          colors={['#78201e', '#80361c', '#854b1d', '#8c6809']}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={18}
          density={0.75}
          gradientOpacity={0.45}
          glyphOpacity={0.5}
          glow={0.08}
        />
      </div>
      <header className="app-brand-header">
        <div className="brand-logo-badge">
          <img
            src="/logo.svg"
            alt="TeaPot Logo"
            className="brand-logo-img"
          />
          <span className="brand-name">TeaPot</span>
        </div>
      </header>
      <main className="app-main">
        <NetworkSliceRecommender />
      </main>
    </>
  )
}

export default App
