/*
 * @Author: wangtao
 * @Date: 2022-02-28 22:55:31
 * @LastEditors: 汪滔
 * @LastEditTime: 2022-03-02 17:09:25
 * @Description: file content
 */
import * as React from "react";

// function App() {
//   React.useEffect(() => {
//     console.log("useEffect")
//   }, [])
//   return <div>App works</div>
// }

class App extends React.Component {
  componentDidMount() {
    console.log("componentDidMount");
  }
  render() {
    return <div>class component</div>;
  }
}

export default App;
