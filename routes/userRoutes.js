import express from 'express'
import moment from 'moment-timezone'
import axios from 'axios'
import connectDB from '../config/db.js'
import User from '../models/userModel.js'
import Job from '../models/jobModel.js'
const router = express.Router()

import {
  getUsers,
  addUser,
  deleteUser,
  updateUser,
} from '../controllers/UserController.js'

const dor = async (req, res) => {
  try {
    
  // @desc fetch new update with populate user
  const updateJobs = await Job.find({ isActive: true }).populate('user')
  
  //@desc run all promise
  await Promise.all(
    updateJobs.map(async (updateJob) => {
      return new Promise(async (resolve, reject) => {
        const { user } = updateJob
        try {
          console.log('Schedule is Proccessing now ========>')
          //@desc call api email service
          const response = await axios.post(
            `${process.env.EMAIL_SERVICE}/send-email`,
            {
              email: updateJob.user?.email,
              message: updateJob.message,
            }
          )

          //@desc if response success then update jobs
          if (response.status === 200) {
            await Job.findOneAndUpdate(
              { _id: updateJob._id },
              { isActive: false }
            )
          } 
          resolve()
        } catch (error) {
          reject(error)
        }
      })
    })
  )


    return res.status(200).json({message: 'ok'})
  } catch (error) {
    return res.status(400).json({message: error.message})
  }
}

router.get('/', getUsers)
router.post('/', addUser)
router.delete('/:id', deleteUser)
router.put('/:id', updateUser)
router.post('/dor', dor)

export default router
