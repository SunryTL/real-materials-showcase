"""Export explicitly selected public evidence fields; never copy private training tables.
Usage: python export-reviewed-research.py /path/to/reviewed92_hierarchy_algorithms_20261029_v1
Requires numpy, pandas, scipy and sklearn. Original release is immutable.
"""
from pathlib import Path
import sys,json,hashlib
import numpy as np
import pandas as pd
from scipy.stats import gaussian_kde
from sklearn.preprocessing import StandardScaler
from sklearn.decomposition import PCA
ROOT=Path(__file__).resolve().parents[1]/'public/workbench/public-data'
SRC=Path(sys.argv[1]); VERSION='pl92_20261026_v1'
def write(path,obj):
 path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(obj,ensure_ascii=False,allow_nan=False,separators=(',',':')))
def sha(p):return hashlib.sha256(p.read_bytes()).hexdigest()
df=pd.read_csv(SRC/'samples92_reviewed.csv').replace({np.nan:None})
assert len(df)==92 and df.sample_id.is_unique
assert df.emission_peak_nm.notna().sum()==92 and df.excitation_5d1_ev.notna().sum()==30
families=sorted(df.report_family.unique()); colors=['#5c99b6','#b49bc6','#7bb7ac','#dc9e94','#9caa60','#e6b94e','#9fbdcf','#cf87ab','#6e90b4','#acb897','#ad877b','#74a4a3']
color={f:colors[i%len(colors)] for i,f in enumerate(families)}
features=['A_Ce_fraction','A_Y_fraction','A_Lu_fraction','A_Gd_fraction','BC_Al_fraction','BC_Ga_fraction','BC_Sc_fraction','A_radius_mean_A','BC_radius_mean_A']
X=df[features].astype(float);assert X.notna().all().all()
pca=PCA(n_components=3);pc=pca.fit_transform(StandardScaler().fit_transform(X))
axes=[dict(key=f'PC{i+1}',min=float(pc[:,i].min()),max=float(pc[:,i].max()),explained_variance_ratio=float(pca.explained_variance_ratio_[i]),top_loadings=[dict(feature=features[j],weight=float(pca.components_[i,j])) for j in np.argsort(-abs(pca.components_[i]))[:4]]) for i in range(3)]
fields=['组成','占位','PL','PLE','烧结温度','厚度','退火温度','结构证据','来源DOI']
def available(r):return [bool(r.normalized_formula),True,r.emission_peak_nm is not None,r.excitation_5d1_ev is not None,r.sintering_temperature_c is not None,r.sample_thickness_mm is not None,r.annealing_temperature_c is not None,bool(r.structure_available),bool(r.doi)]
records=[];points=[];quality=[]
for i,r in df.iterrows():
 av=available(r); rec=dict(sample_id=r.sample_id,doi=r.doi,family=r.report_family,formula=r.normalized_formula,material_form='ceramic',emission_nm=float(r.emission_peak_nm),available_fields=sum(av),total_fields=len(fields),coverage_fraction=sum(av)/len(fields),status='formal')
 records.append(rec);points.append(dict(rec,plot_family=r.report_family,PC1=float(pc[i,0]),PC2=float(pc[i,1]),PC3=float(pc[i,2]),coincident_count=1));quality.append(dict(sample_id=r.sample_id,family=r.report_family,available=av))
# PCA positions describe a composition/descriptor projection; galaxy positions remain relational.
coords=pd.DataFrame(pc).round(9);counts=coords.groupby([0,1,2])[0].transform('size')
for p,n in zip(points,counts):p['coincident_count']=int(n)
def density(values,grid):
 a=np.array(values,dtype=float)
 if len(a)<2 or np.ptp(a)==0:return [0.0]*len(grid)
 return gaussian_kde(a)(grid).tolist()
def make(family='',form=''):
 sub=df if not family else df[df.report_family==family]; ids=set(sub.sample_id); rr=[r for r in records if r['sample_id'] in ids]; grid=np.linspace(480,610,220)
 groups=[]
 for f,g in sub.groupby('report_family'):
  vals=g.emission_peak_nm.astype(float)
  groups.append(dict(name=f,color=color[f],n=len(g),median=float(vals.median()),min=float(vals.min()),max=float(vals.max()),density=density(vals,grid),points=[dict(sample_id=r.sample_id,x=float(r.emission_peak_nm)) for _,r in g.iterrows()]))
 pair=sub[sub.excitation_5d1_ev.notna()]; relationship=[dict(sample_id=r.sample_id,x=float(r.excitation_5d1_ev),y=float(r.emission_peak_nm),family=r.report_family,color=color[r.report_family]) for _,r in pair.iterrows()]
 xgrid=np.linspace(2.3,3.2,150); ygrid=grid; rg=[]
 for f,g in pair.groupby('report_family'):rg.append(dict(family=f,color=color[f],density_x=density(g.excitation_5d1_ev,xgrid),density_y=density(g.emission_peak_nm,ygrid)))
 corrfields=['A_Ce_fraction','BC_Ga_fraction','A_radius_mean_A','BC_radius_mean_A','emission_peak_nm','excitation_5d1_ev','sintering_temperature_c','sample_thickness_mm']
 corr=[]
 for i,a in enumerate(corrfields):
  for j,b in enumerate(corrfields):
   valid=sub[[a,b]].dropna(); n=len(valid); v=None
   if n>=15 and sub[a].nunique()>1 and sub[b].nunique()>1:
    value=sub[a].astype(float).corr(sub[b].astype(float),method='spearman');v=float(value) if np.isfinite(value) else None
   corr.append(dict(i=i,j=j,n=n,r=v))
 rows=[r for r in quality if r['sample_id'] in ids]; hist,edges=np.histogram(sub.emission_peak_nm.astype(float),bins=np.linspace(480,610,27))
 return dict(version=VERSION,source_hash=sha(SRC/'samples92_reviewed.csv'),scope=dict(family=family,material_form=form,status='formal'),options=dict(families=families,material_forms=['ceramic'],versions=['v1.3_20260725',VERSION]),summary=dict(samples=len(sub),doi=sub.doi.nunique(),families=sub.report_family.nunique(),projected=len(sub)),records=rr,points=[p for p in points if p['sample_id'] in ids],axes=axes,family_colors={f:color[f] for f in sorted(sub.report_family.unique())},charts=dict(
 emission=dict(grid=grid.tolist(),groups=groups,histogram=[dict(left=float(edges[i]),right=float(edges[i+1]),count=int(n)) for i,n in enumerate(hist)],ecdf=[dict(x=float(x),y=(i+1)/len(sub)) for i,x in enumerate(sorted(sub.emission_peak_nm))]),
 relationship=dict(x_label='PLE 激发观测 / eV',y_label='发射波长 / nm',points=relationship,x_grid=xgrid.tolist(),y_grid=ygrid.tolist(),groups=rg),
 quality=dict(fields=fields,rows=rows,coverage=[dict(field=f,count=sum(r['available'][i] for r in rows),total=len(rows)) for i,f in enumerate(fields)],sources=[dict(source='经核验的文献记录',count=len(sub))]),
 evidence=dict(families=[dict(family=f,samples=len(g),doi=g.doi.nunique(),series=g.group_series.nunique()) for f,g in sub.groupby('report_family')],papers=[dict(doi=d,samples=len(g)) for d,g in sub.groupby('doi')]),correlation=dict(labels=corrfields,values=corr),readiness=[dict(model='PL',ready=len(sub),total=len(sub)),dict(model='PL / PLE',ready=len(pair),total=len(sub))]))
scopes={}
for family in ['',*families]:
 for form in ['', 'ceramic']:
  key=f'formal|{family}|{form}';name=hashlib.sha256(key.encode()).hexdigest()[:16]+'.json';scopes[key]='explorer/'+name;write(ROOT/'releases'/VERSION/'explorer'/name,make(family,form))
write(ROOT/'releases'/VERSION/'manifest.json',dict(database_version=VERSION,scopes=scopes,source_hash=sha(SRC/'samples92_reviewed.csv'),mode='public-read-only',description='论文核验训练子集：92条PL，30组PL/PLE；与完整文献库分别保留。PCA采用组成和半径描述符标准化投影。'))
write(ROOT/'versions.json',dict(versions=[dict(version='v1.3_20260725',label='完整文献库 · v1.3_20260725'),dict(version=VERSION,label='论文核验子集 · PL92 / 配对30 · 2026-10-26')]))
summary=pd.read_csv(SRC/'summary.csv'); pred=pd.read_csv(SRC/'predictions.csv');gp=pred[pred.route=='joint_gpr']
assert len(gp)==276 and gp.groupby('seed').sample_id.nunique().eq(92).all()
# Recalculate each repeat's OOF metrics, then average; repetitions are not new samples.
from sklearn.metrics import r2_score,mean_absolute_error,mean_squared_error
for route,g in pred.groupby('route'):
 s=summary[(summary.route==route)&(summary.task=='emission')].iloc[0]
 vals=[(r2_score(x.actual_nm,x.predicted_nm),mean_absolute_error(x.actual_nm,x.predicted_nm),mean_squared_error(x.actual_nm,x.predicted_nm)**.5) for _,x in g.groupby('seed')]
 assert np.allclose(np.mean(vals,axis=0),[s.r2,s.mae,s.rmse],rtol=1e-9)
names={'joint_gpr':'Gaussian process','joint_svr':'Support vector regression','joint_extra_trees':'Extra Trees','joint_ridge':'Ridge','joint_xgboost':'XGBoost','joint_random_forest':'Random forest','joint_inner_selected':'内层算法选择'}
write(ROOT/'research-20261029.json',dict(version='reviewed92_hierarchy_algorithms_20261029_v1',date='2026-10-29',database_version=VERSION,n=92,paired=30,seeds=sorted(gp.seed.unique().tolist()),metrics=[dict(route=r.route,name=names[r.route],mae=r.mae,mae_sd=r.mae_sd,rmse=r.rmse,r2=r.r2,r2_sd=r.r2_sd) for _,r in summary[summary.task=='emission'].sort_values('mae').iterrows()],records=records,predictions=[dict(sample_id=r.sample_id,seed=int(r.seed),fold=int(r.fold),actual_nm=r.actual_nm,predicted_nm=r.predicted_nm) for _,r in gp.iterrows()],source_hashes={f:sha(SRC/f) for f in ['samples92_reviewed.csv','predictions.csv','summary.csv','splits.json']},validation='3次重复×5折组成分组嵌套交叉验证；指标为每次完整折外预测的均值。'))
print('Exported reviewed explorer and independently checked OOF metrics. Historical release untouched.')
