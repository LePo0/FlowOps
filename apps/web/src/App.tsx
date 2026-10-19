import { Canvas } from "./editor/Canvas.tsx";
import { NodePanel } from "./editor/panel/NodePanel.tsx";
import { RunBar } from "./run/RunBar.tsx";
import { DocumentBar } from "./workflows/DocumentBar.tsx";
import "./App.css";

function App() {
  return (
    <div className="app">
      <header className="app__header">
        <h1 className="app__title">FlowOps</h1>
        <DocumentBar />
        <RunBar />
      </header>
      <main className="app__body">
        <div className="app__canvas">
          <Canvas />
        </div>
        <NodePanel />
      </main>
    </div>
  );
}

export default App;
