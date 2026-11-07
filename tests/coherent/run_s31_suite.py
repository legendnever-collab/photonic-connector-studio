"""Reproducible bounded experiments with per-run checkpoints and timeouts.

Harness success is independent of Physics PASS. No actual Lens is evaluated.
"""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import time
from run_s3_preflight import ROOT,digest,git


def commands(profile):
    if profile=='planar':
        yield ['run_s31_api_audit.py']
        yield ['run_s31_planar.py','--suite','homogeneous','--name','homogeneous']
        cases=[('long',[]),('long-fine',['--points','80']),
            ('short',['--thickness','3']),('short-fine',['--thickness','3','--points','40','80','160']),
            ('settling',['--points','40','--settling','8']),('settling16',['--points','40','--settling','16']),
            ('pml',['--points','40','--pml','5']),('padding',['--points','40','--padding','4']),
            ('shift',['--points','40','--shift-cells','.25']),('no-average',['--points','40','--no-averaging']),
            ('bandwidth',['--points','40','--fwidth','.2']),('negative-time',['--points','40','--settling','.1']),
            ('short-pml',['--thickness','3','--points','160','--pml','5']),
            ('short-settling',['--thickness','3','--points','160','--settling','8'])]
        for name,args in cases:
            yield ['run_s31_planar.py','--suite','boundary','--name',name,*args]
    else:
        for resolution in [4,6,8]:
            yield ['run_s31_gaussian.py','--resolution',str(resolution),'--name',f'gaussian-r{resolution}']
        for name,args in [('disk',['--disk','100']),('window',['--window','190']),('pml',['--pml','7']),
                          ('time',['--after','360']),('sampling',['--source-spacing','.2'])]:
            yield ['run_s31_gaussian.py','--resolution','4','--name','gaussian-'+name,*args]


def main():
    p=argparse.ArgumentParser();p.add_argument('profile',choices=['planar','gaussian']);a=p.parse_args()
    out=ROOT/'benchmark-results';out.mkdir(exist_ok=True)
    source_hashes={str(path.relative_to(ROOT)):digest(path) for path in Path(__file__).parent.glob('*s31*.py')}
    report=dict(gitSHA=git('rev-parse','HEAD'),headSHA=os.getenv('GOLDEN_HEAD_SHA'),profile=a.profile,
        sourceSHA256=source_hashes,cpuAffinity=len(os.sched_getaffinity(0)),jobMemoryLimitBytes=None,jobTimeLimitS=None,
        memoryInfo={k:v.strip() for k,v in (line.split(':',1) for line in Path('/proc/meminfo').read_text().splitlines()) if k in ['MemTotal','MemAvailable']},
        runStatus='running',runs=[],physicsReferenceStatus='uncomputed',lensField=None,lensFlux=None,lensModeProjection=None,
        totalCoupling=None,assemblyYield=None)
    def save():
        (out/f's31-{a.profile}-execution.json').write_text(json.dumps(report,indent=2)+'\n')
    save()
    for command in commands(a.profile):
        full=[sys.executable,str(Path(__file__).parent/command[0]),*command[1:]]
        start=time.monotonic();print('RUN',command,flush=True)
        try:
            result=subprocess.run(full,timeout=1200,check=False)
            status='completed' if result.returncode==0 else 'failed'
        except subprocess.TimeoutExpired:
            status='timeout'
        report['runs'].append(dict(command=command,status=status,elapsedS=time.monotonic()-start));save()
        if status!='completed':
            report['runStatus']=status;save();raise SystemExit(1)
    report['runStatus']='completed';save()


if __name__=='__main__':
    main()
