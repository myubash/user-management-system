import { parentPort } from 'worker_threads'
import moment from 'moment-timezone'
import axios from 'axios'
import User from '../models/userModel.js'
import Job from '../models/jobModel.js'

//@desc worker threads variable
let isCanceled = false
if (parentPort) {
  parentPort.once('message', (message) => {
    if (message === 'cancel') isCanceled = true
  })
}

//@desc IIFE
// ;(async (timeZone, schedule) => {
;(async () => {
  console.log('Checking User Detail ========>')
  if (isCanceled) return

  //@desc collect user data
  const users = await User.find({
    birthDay: moment().tz(moment.tz.guess()).startOf('day'),
  }).lean()
  const usersIds = users.map(u => u._id)

  //@desc if there are new data store to jobs
  if (users.length) {
    const jobs = await Job.find({
      user: {$in: usersIds}
    })
      .select({ user: 1, _id: 0 })
      .populate('user')

    const target = jobs.map(j => j.user)

    //@desc set new jobs based on user birthday
    if (target || target.length != 0) {
      target.map(async (data) => {
        await Job.create({
          user: data._id,
          message: `Hey ${data.firstName}, Today ${moment(data.birthDay).tz(data.location).format('DD MMMM YYYY')} is your day`,
        })
      })
    }
  }

  // @desc fetch new update with populate user
  const updateJobs = await Job.find({ isActive: true }).populate('user')
  
  //@desc run all jobs
  await Promise.all(
    updateJobs.map(async (updateJob) => {
      return new Promise(async (resolve, reject) => {
        const { user } = updateJob
        try {
          //@desc check condition and schedule to localtime user - using moment
          // exact on 9 am based on user local time
          if (
            moment.tz("09:00", "HH:mm", user.timeZone).isSame(moment().utc())
          ) {
            console.log('Schedule is Proccessing now ========>')
            try {
              //@desc call api email service
              const response = await axios.post(
                `${process.env.EMAIL_SERVICE}/send-email`,
                {
                  email: updateJob.user?.email,
                  message: updateJob.message,
                }
              )

              // console.log(response.data, 'response')
              //@desc if response success then update jobs
              if (response.status === 200) {
                await Job.findOneAndUpdate(
                  { _id: updateJob._id },
                  { isActive: false }
                )
              }
            } catch (error) {
              console.log(error)
            }
            resolve()
          } else {
            resolve()
          }
        } catch (error) {
          reject(error)
        }
      })
    })
  )
  if (parentPort) parentPort.postMessage('done')
  else process.exit(0)
// })(moment.tz.guess(), moment().set({ hour: 9, minute: 0, second: 0 })) //@desc check timezone, set scheduler
})()

