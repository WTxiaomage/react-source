/*
 * @Author: wangtao
 * @Date: 2022-02-28 22:55:31
 * @LastEditors: 汪滔
 * @LastEditTime: 2022-03-09 21:19:56
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
  constructor(props) {
    super(props);
    this.state = {
      isShow: true,
    };
  }

  componentDidMount() {
    console.log("componentDidMount");
  }
  render() {
    const { isShow } = this.state;
    return (
      <div>
        <p>111</p>
        {isShow && <p>222</p>}
        <button
          onClick={() => {
            this.setState({ isShow: !isShow });
          }}
        >
          显示
        </button>
        <Test></Test>
      </div>
    );
  }
}

class Test extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      isTestShow: true,
    };
  }

  componentDidMount() {
    console.log("componentDidMount");
  }
  render() {
    const { isTestShow } = this.state;
    return (
      <div>
        <p>3333</p>
        {isTestShow && <p>4444</p>}
        <button
          onClick={() => {
            this.setState({ isTestShow: !isTestShow });
          }}
        >
          test显示
        </button>
      </div>
    );
  }
}

export default App;
