import GradientASCII from './components/GradientASCII'
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
      <main className="app-main">
        <NetworkSliceRecommender />
      </main>
    </>
  )
}

export default App
