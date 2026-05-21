import { ref } from "@actview/core";
import { MySwitch } from "@/components/switch";
import "./switch.css";


export const Switch = () => {
  const isOn = ref(false);
  isOn.value = false;

  return () => (
    <div class="switch-demo">
      <div class="section">
        <h2>开关类型 / Switch Types</h2>
        <div class="switch-group">
          <div class="label-row"><MySwitch type="primary" checked /><span>Primary</span></div>
          <div class="label-row"><MySwitch type="success" checked /><span>Success</span></div>
          <div class="label-row"><MySwitch type="danger" checked /><span>Danger</span></div>
          <div class="label-row"><MySwitch type="warning" checked /><span>Warning</span></div>
        </div>
      </div>
      <div class="section">
        <h2>开关尺寸 / Switch Sizes</h2>
        <div class="switch-group">
          <div class="label-row"><MySwitch type="primary" size="sm" checked /><span>Small</span></div>
          <div class="label-row"><MySwitch type="primary" checked /><span>Default</span></div>
          <div class="label-row"><MySwitch type="primary" size="lg" checked /><span>Large</span></div>
        </div>
      </div>
      <div class="section">
        <h2>开关状态 / Switch States</h2>
        <div class="switch-group">
          <div class="label-row"><MySwitch type="primary" /><span>Off</span></div>
          <div class="label-row"><MySwitch type="primary" checked /><span>On</span></div>
          <div class="label-row"><MySwitch type="primary" disabled /><span>Disabled (Off)</span></div>
          <div class="label-row"><MySwitch type="primary" checked disabled /><span>Disabled (On)</span></div>
        </div>
      </div>
      <div class="section">
        <h2>交互演示 / Interactive Demo</h2>
        <div class="switch-group">
          <div class="label-row">
            <MySwitch type="primary" checked={isOn.value ? true : undefined} onToggle={() => isOn.value = !isOn.value} />
            <span>点击切换</span>
          </div>
        </div>
        <p>开关状态: {isOn.value ? "开启" : "关闭"}</p>
      </div>
    </div>
  );
};
