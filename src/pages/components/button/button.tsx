import { useResolveOptions, ref } from "@actview/core";
import { MyButton } from "@/components/button";
import { MyAddIcon } from "@/components/svg-icon";
import "./button.css";

export const Button = () => {
  const count = ref(0);
  count.value = 0;
  useResolveOptions([
    {
      selector: '[data-id="counter-btn"]',
      text: () => `点击计数: ${count.value}`,
      listeners: [
        {
          type: "click",
          callback: () => {
            count.value++;
          },
        },
      ],
    },
    {
      selector: '[data-id="reset-btn"]',
      listeners: [
        {
          type: "click",
          callback: () => {
            count.value = 0;
          },
        },
      ],
    },
    {
      selector: "#click-count",
      text: () => `点击次数: ${count.value}`,
    },
  ]);
  return (
    <>
      <div class="section">
        <h2>按钮类型 / Button Types</h2>
        <div class="button-group">
          <MyButton type="primary">Primary</MyButton>
          <MyButton type="secondary">Secondary</MyButton>
          <MyButton type="success">Success</MyButton>
          <MyButton type="danger">Danger</MyButton>
          <MyButton type="warning">Warning</MyButton>
          <MyButton type="ghost">Ghost</MyButton>
          <MyButton type="link">Link</MyButton>
        </div>
      </div>
      <div class="section">
        <h2>按钮尺寸 / Button Sizes</h2>
        <div class="button-group">
          <MyButton type="primary" size="sm">
            Small
          </MyButton>
          <MyButton type="primary">Default</MyButton>
          <MyButton type="primary" size="lg">
            Large
          </MyButton>
        </div>
      </div>
      <div class="section">
        <h2>按钮状态 / Button States</h2>
        <div class="button-group">
          <MyButton type="primary">Normal</MyButton>
          <MyButton type="primary" disabled>
            Disabled
          </MyButton>
          <MyButton type="primary" loading>
            Loading
          </MyButton>
        </div>
      </div>
      <div class="section">
        <h2>图标按钮 / Icon Buttons</h2>
        <div class="button-group">
          <MyButton type="primary">
            <template slot="before">
              <svg
                class="btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M12 5v14M5 12h14" />
              </svg>
            </template>
            添加
          </MyButton>
          <MyButton type="danger">
            <template slot="before">
              <svg
                class="btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </template>
            删除
          </MyButton>
          <MyButton type="success">
            <template slot="before">
              <svg
                class="btn-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                stroke-width="2"
              >
                <path d="M5 13l4 4L19 7" />
              </svg>
            </template>
            确认
          </MyButton>
          <MyButton type="primary" class="btn-circle">
            <MyAddIcon></MyAddIcon>
          </MyButton>
        </div>
      </div>
      <div class="section" id="component-button">
        <h2>交互演示 / Interactive Demo</h2>
        <div class="button-group">
          <MyButton type="primary" data-id="counter-btn">
            点击计数
          </MyButton>
          <MyButton type="secondary" data-id="reset-btn">
            重置
          </MyButton>
        </div>
        <p id="click-count">点击次数: 0</p>
      </div>
    </>
  );
};
