import React from 'react';import {createRoot} from 'react-dom/client';import App from './App';import './index.css';
class EB extends React.Component<{children:React.ReactNode},{e:boolean}>{state={e:false};static getDerivedStateFromError(){return{e:true}}
render(){return this.state.e?<div className="p-8 text-center"><p>Something went wrong.</p><button className="mt-4 px-6 py-3 bg-emerald-600 text-white rounded-xl" onClick={()=>location.reload()}>Reset</button></div>:this.props.children}}
createRoot(document.getElementById('root')!).render(<EB><App/></EB>);
