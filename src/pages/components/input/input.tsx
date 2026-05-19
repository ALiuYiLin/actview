import { ref } from "@actview/core";
import { MyInput } from "@/components/input";
import "./input.css";


export const Input = () => {
  const inputValue = ref("");
  inputValue.value = "";

  return () => (
    <>
      <div class="section">
        <h2>输入框类型 / Input Types</h2>
        <div class="input-vertical">
          <MyInput type="primary" placeholder="Primary 输入框" />
          <MyInput type="success" placeholder="Success 输入框" />
          <MyInput type="danger" placeholder="Danger 输入框" />
          <MyInput type="warning" placeholder="Warning 输入框" />
        </div>
      </div>
      <div class="section">
        <h2>输入框尺寸 / Input Sizes</h2>
        <div class="input-vertical">
          <MyInput type="primary" size="sm" placeholder="Small 输入框" />
          <MyInput type="primary" placeholder="Default 输入框" />
          <MyInput type="primary" size="lg" placeholder="Large 输入框" />
        </div>
      </div>
      <div class="section">
        <h2>输入框状态 / Input States</h2>
        <div class="input-vertical">
          <MyInput type="primary" placeholder="正常状态" />
          <MyInput type="primary" disabled placeholder="禁用状态" value="Disabled" />
          <MyInput type="primary" readonly value="只读内容 - Readonly" />
        </div>
      </div>
      <div class="section">
        <h2>可清除 / Clearable</h2>
        <div class="input-vertical">
          <MyInput type="primary" clearable placeholder="输入后可清除" />
        </div>
      </div>
      <div class="section">
        <h2>原生类型 / Native Types</h2>
        <div class="input-vertical">
          <div class="label-row"><span style="min-width:60px">text:</span><MyInput placeholder="文本输入" /></div>
          <div class="label-row"><span style="min-width:60px">number:</span><MyInput input-type="number" placeholder="数字输入" /></div>
          <div class="label-row"><span style="min-width:60px">email:</span><MyInput input-type="email" placeholder="邮箱输入" /></div>
          <div class="label-row"><span style="min-width:60px">tel:</span><MyInput input-type="tel" placeholder="电话输入" /></div>
        </div>
      </div>
      <div class="section">
        <h2>交互演示 / Interactive Demo</h2>
        <div class="input-vertical">
          <MyInput type="primary" placeholder="输入内容实时显示..." />
        </div>
        <p>输入内容: {inputValue.value}</p>
      </div>
    </>
  );
};
