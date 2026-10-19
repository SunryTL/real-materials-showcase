"""Local-only fixed-command training jobs. Private artifacts stay on disk."""
import json
import fcntl
import math
from pathlib import Path
import re
import subprocess
from threading import Lock
from uuid import uuid4
from contextlib import ExitStack

PARAMETERS = {
    'length': {'default':1.5,'min':.1,'max':10,'label':'材料相似性尺度','help':'越大，越倾向于平滑的组成变化。'},
    'noise': {'default':.02,'min':.001,'max':.2,'label':'观测噪声（eV）','help':'控制对光谱标签的信任程度，不是实测误差。'},
    'loss_interaction': {'default':.5,'min':0,'max':1,'label':'损失分支交互强度','help':'0为加性关系，越大越强调特征模块共同作用。'},
    'correction_amplitude': {'default':.1,'min':0,'max':.3,'label':'陶瓷修正幅度（eV）','help':'0关闭条件修正；数值越大，允许的修正越强。'},
    'domain_sd': {'default':.05,'min':0,'max':.3,'label':'粉体来源差异（eV）','help':'表达辅助粉体与陶瓷之间的来源偏移。'},
}


def validate(parameters):
    if not isinstance(parameters,dict) or set(parameters)-set(PARAMETERS):
        raise ValueError('只能设置已列出的模型参数')
    values={key:parameters.get(key,spec['default']) for key,spec in PARAMETERS.items()}
    for key,value in values.items():
        spec=PARAMETERS[key]
        if (isinstance(value,bool) or not isinstance(value,(float,int))
            or not math.isfinite(value) or not spec['min']<=value<=spec['max']):
            raise ValueError(f"{spec['label']}须在{spec['min']}至{spec['max']}之间")
    return values


class ModelRuns:
    def __init__(self,root,repository,python):
        self.root=Path(root)
        self.repository=Path(repository).resolve()
        self.python=str(python)
        self.processes={}
        self.lock=Lock()

    def start(self,parameters,candidate=None):
        values=validate(parameters)
        if not (self.repository/'research/code/interactive_joint_run.py').is_file():
            raise ValueError('本地研究库缺少已验证的训练入口')
        with self.lock, ExitStack() as handles:
            if any(p.poll() is None for p in self.processes.values()):
                raise ValueError('已有训练正在运行，请完成后再启动')
            self.root.mkdir(parents=True,exist_ok=True)
            global_lock=handles.enter_context((self.root/'.training.lock').open('a+b'))
            try:
                fcntl.flock(global_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            except BlockingIOError:
                raise ValueError('已有训练正在运行，请完成后再启动') from None
            identifier=uuid4().hex
            folder=self.root/identifier
            folder.mkdir(parents=True,exist_ok=False)
            run_lock=handles.enter_context((folder/'process.lock').open('a+b'))
            fcntl.flock(run_lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
            (folder/'parameters.json').write_text(json.dumps(values,allow_nan=False))
            (folder/'request.json').write_text(json.dumps(dict(id=identifier,parameters=values,
                candidate_decision_ids=[r['id'] for r in candidate['changes']] if candidate else [])))
            extra=[]
            if candidate is not None:
                path=folder/'candidate.json'
                path.write_text(json.dumps(candidate,ensure_ascii=False,allow_nan=False))
                extra=['--candidate',str(path.resolve())]
            with (folder/'training.log').open('wb') as log:
                self.processes[identifier]=subprocess.Popen([
                    self.python,'-m','research.code.interactive_joint_run',
                    '--config',str((folder/'parameters.json').resolve()),
                    '--output-root',str((folder/'results').resolve()),*extra],
                    cwd=self.repository,stdin=subprocess.DEVNULL,stdout=log,stderr=subprocess.STDOUT,
                    start_new_session=True,pass_fds=(global_lock.fileno(),run_lock.fileno()))
            # Child inherits both lock descriptors. Closing the parent's copies
            # leaves locks held until the actual training process exits.
        return self.status(identifier)

    def status(self,identifier):
        if not re.fullmatch(r'[0-9a-f]{32}',identifier):
            raise ValueError('运行编号无效')
        folder=self.root/identifier
        request=json.loads((folder/'request.json').read_text())
        process=self.processes.get(identifier)
        code=process.poll() if process is not None else None
        live=process is not None and code is None
        lock_path=folder/'process.lock'
        if process is None and lock_path.exists():
            with lock_path.open('rb') as handle:
                try:
                    fcntl.flock(handle,fcntl.LOCK_EX|fcntl.LOCK_NB)
                except BlockingIOError:
                    live=True
        # Older runs have no live lock evidence; retain their uncertainty.
        status='running' if live else ('failed' if lock_path.exists() else 'unknown')
        completed=0; summary=[]
        files=list((folder/'results').glob('*/status.json'))
        if len(files)==1:
            result=json.loads(files[0].read_text())
            completed=result.get('completed_folds',0)
            if result.get('status') in {'completed','failed'}:
                status=result['status']
            if status=='completed':summary=result.get('summary',[])
        if code is not None and code!=0:status='failed'
        elif code==0 and status!='completed':status='failed'
        # Do not expose tracebacks, paths or sample-level results in this API.
        return dict(id=identifier,parameters=request['parameters'],status=status,
                    candidate_decision_ids=request.get('candidate_decision_ids',[]),
                    labels_revised=bool(request.get('candidate_decision_ids')),
                    completed_folds=completed,total_folds=15,summary=summary,
                    development_only=True,authority_database_changed=False)

    def list(self):
        if not self.root.exists():return []
        return [self.status(p.name) for p in sorted(self.root.iterdir(),key=lambda p:p.stat().st_mtime,reverse=True)
                if p.is_dir() and re.fullmatch(r'[0-9a-f]{32}',p.name)]
