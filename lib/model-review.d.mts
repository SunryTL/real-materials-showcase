export function filterReviewSamples<T extends {sample_id:string;family:string;doi:string}>(rows:T[],family:string,query:string):T[];
export function familyEvidenceGaps(row:{records:number;compositions:number;sources:number;pl:number;ple:number;paired:number}):string[];
