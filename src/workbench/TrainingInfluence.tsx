export type InfluenceEffect = {
  baseline_mae:number; removed_mae:number; delta_mae:number; n:number;
  improved_partitions:number; refitted_folds:number;
};
export type InfluenceSample = {
  sample_id:string; family:string;
  training_influence?:Record<'emission'|'excitation'|'loss',InfluenceEffect>;
};
const signed=(n:number)=>`${n>0?'+':''}${n.toFixed(3)}`;

export function TrainingInfluence({samples,partitions,onSelect,disabled}:{
  samples:InfluenceSample[];partitions:number;onSelect:(id:string)=>void;disabled:boolean;
}) {
  const rows=samples.filter(row=>row.training_influence).sort((a,b)=>a.training_influence!.emission.delta_mae-b.training_influence!.emission.delta_mae);
  return <details className="review-coverage review-influence">
    <summary>训练影响：暂时不用这条记录会怎样？</summary>
    <p>每次只暂时移除一条训练记录，重新拟合，再比较同一批其他测试样品。表格按发射误差变化排序，样品自己的误差不计入。</p>
    <p><b>负数：其他样品误差降低；正数：其他样品误差增加，说明这条记录对训练有帮助。</b>三个任务一起看，再核对原文决定是否修正。</p>
    <div className="review-table review-samples" tabIndex={0} aria-label="训练影响表，可横向滚动"><table>
      <caption>原误差 → 暂不训练该记录后的误差；括号为变化量。单位：发射 nm，激发与损失 meV。</caption>
      <thead><tr><th>样品</th><th>体系</th><th>发射 MAE</th><th>激发 MAE</th><th>损失 MAE</th><th>人工审核</th></tr></thead>
      <tbody>{rows.map(row=><tr key={row.sample_id}><th>{row.sample_id}</th><td>{row.family}</td>
        {(['emission','excitation','loss'] as const).map(task=>{
          const effect=row.training_influence![task];
          return <td key={task}>{effect.baseline_mae.toFixed(3)} → {effect.removed_mae.toFixed(3)} <b>（{signed(effect.delta_mae)}）</b><br/>
            <small>评价 {effect.n} 条；{effect.improved_partitions}/{partitions} 套划分误差降低{effect.refitted_folds===0?'；本轮无训练标签':''}</small></td>;
        })}
        <td><button disabled={disabled} aria-label={`从训练影响审核 ${row.sample_id}`} onClick={()=>onSelect(row.sample_id)}>核对原文</button></td>
      </tr>)}</tbody>
    </table>{rows.length===0 && <p>当前筛选下没有训练影响记录。</p>}</div>
    <p>这是固定模型与划分下的开发诊断；三套划分不是三次独立实验。暂时移除的对照结果用于找审核线索，不直接改库。</p>
  </details>;
}
