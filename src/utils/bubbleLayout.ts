// 泡泡默认偏移计算：根据地点在路线中的位置，交替上下放置
// 避免备注遮挡手绘连线与坐标点

// 奇数序号（第 1、3、5… 个）泡泡放上方，偶数序号放下方
// 相邻地点的泡泡分列上下，中间的连线不会被遮挡
export function defaultBubbleOffset(index0: number): { x: number; y: number } {
  // index0 是 0-based 索引
  const isUp = index0 % 2 === 0;
  // x 轻微错开，避免箭头压在图钉正上方
  const x = isUp ? 18 : -18;
  // y 距离足够远，确保不压住图钉（图钉高度约 52px）与连线
  const y = isUp ? -135 : 135;
  return { x, y };
}
