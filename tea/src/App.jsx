import GradientASCII from './components/GradientASCII'
import ShinyText from './components/ShinyText'
import NetworkSliceRecommender from './components/NetworkSliceRecommender'
import './App.css'

function App() {
  return (
    <>
      <div className="ascii-background" aria-hidden="true">
        <GradientASCII
          colors={['#e93e3a', '#ed683c', '#f3903f', '#fdc70c']}
          shape="horizon"
          characters=" =+xX0S8#@"
          cellSize={18}
          density={0.8}
        />
      </div>
      <header className="top-right-header">
        <ShinyText
          text="TeaPot"
          color="#b5b5b5"
          shineColor="#ffffff"
          speed={2}
          shineWidth={40}
          softness={0.8}
          trigger="loop"
          className="teapot-text"
        />
      </header>
      <main className="app-main">
        <NetworkSliceRecommender />
      </main>
    </>
  )
}

export default App
