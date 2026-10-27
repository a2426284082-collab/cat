// Executes production SQL against real SQLite, including batch transactions.
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
export function makeDB(){
  const sql=new DatabaseSync(':memory:');
  sql.exec(readFileSync(new URL('../migrations/0001_sales_ai.sql',import.meta.url),'utf8'));
  class Statement {
    constructor(query,args=[]){this.query=query;this.args=args;}
    bind(...args){return new Statement(this.query,args);}
    execute(){
      const statement=sql.prepare(this.query);
      let results;
      if(statement.columns().length)results=statement.all(...this.args).map(row=>({...row}));
      else{statement.run(...this.args);results=[];}
      return {success:true,results,meta:{changes:Number(sql.prepare('SELECT changes() AS n').get().n)}};
    }
    async first(){return this.execute().results[0]??null;}
    async all(){return this.execute();}
    async run(){return this.execute();}
  }
  return {sql,prepare(query){return new Statement(query);},async batch(statements){
    sql.exec('BEGIN IMMEDIATE');try{const results=statements.map(s=>s.execute());sql.exec('COMMIT');return results;}catch(e){sql.exec('ROLLBACK');throw e;}
  },close(){sql.close();}};
}
