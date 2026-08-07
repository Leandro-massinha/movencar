import type { NextFunction,Request,Response } from 'express'
import { prisma } from '../../lib/prisma.js'
import { AppError } from '../../lib/errors.js'

export async function listEnabledModules(companyId:string,at=new Date()){
  const rows=await prisma.companyModule.findMany({where:{companyId,status:'ACTIVE',activatedAt:{lte:at},OR:[{expiresAt:null},{expiresAt:{gt:at}}],module:{status:'ACTIVE'}},select:{module:{select:{code:true}}}})
  return rows.map(({module})=>module.code)
}

export const requireModule=(code:string)=>async(req:Request,_res:Response,next:NextFunction)=>{
  try{
    if(!req.auth)throw new AppError(401,'AUTH_REQUIRED','Autenticacao obrigatoria.')
    const enabled=await prisma.companyModule.findFirst({where:{companyId:req.auth.companyId,status:'ACTIVE',activatedAt:{lte:new Date()},OR:[{expiresAt:null},{expiresAt:{gt:new Date()}}],module:{code,status:'ACTIVE'}},select:{companyId:true}})
    if(!enabled)throw new AppError(403,'MODULE_NOT_AVAILABLE','Modulo nao contratado ou indisponivel.')
    next()
  }catch(error){next(error)}
}
