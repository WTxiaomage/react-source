/*
 * @Author: wangtao
 * @Date: 2022-02-28 22:55:31
 * @LastEditors: 汪滔
 * @LastEditTime: 2022-09-28 23:16:02
 * @Description: file content
 */
import * as React from "react";

// function App() {
//   const [isShow, setIsShow] = React.useState(true);
//   debugger;
//   return (
//     <div>
//       <p>111</p>
//       {isShow && <p>222</p>}
//       <button
//         onClick={() => {
//           debugger;
//           setIsShow(!isShow);
//         }}
//       >
//         显示
//       </button>
//     </div>
//   );
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
    console.log("🚀🚀🚀wimi======>>>111111");
    debugger;
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
    console.log("🚀🚀🚀wimi======>>>22222");
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
