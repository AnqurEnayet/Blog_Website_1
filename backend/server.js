const express = require('express')
const admin = require('firebase-admin')
const bodyParser = require('body-parser')
const cors = require('cors')
const multer = require('multer')

const serviceAccountKey = require('./serviceAccountKey.json')

admin.initializeApp({
    credential: admin.credential.cert(serviceAccountKey),
    databaseURL: 'https://blogwebsite1-3694a-default-rtdb.firebaseio.com/',
    storageBucket: 'blogwebsite1-3694a.appspot.com' //only the bucket name part and remove the http part
  });

const db = admin.database()
const bucket = admin.storage().bucket()

const app = express()
const upload = multer({ storage: multer.memoryStorage() });
const port = 5000

app.use(cors())
app.use(bodyParser.json())

//API For Avoiding Similar Email and Username

app.post('/checkInput', async(req, res)=>{

    const usedEmail = await db.ref('users').orderByChild('email').equalTo(req.body.email).once('value');
    const usedUsername = await db.ref('users').orderByChild('username').equalTo(req.body.username).once('value');
    
    
    if(usedEmail.exists() && usedUsername.exists()){
        return res.json({exists: true, message: "Email and Username are already in use!"}) 
    } else if(usedEmail.exists()){
        return res.json({exists: true, message: "Email is already in use!"})
    } else if(usedUsername.exists()){
        return res.json({exists: true, message: "Username is already in use!"})
    } else {
        return res.json({exists: false})
    }
    /*const usedEmail = db.ref('users').orderByChild('email').equalTo(req.body.email).once('value', snapshot=>{
        if(snapshot.exists()){
            return res.json({exists: true})
        }
        else {
            return res.json({exists: false})
        }
    })*/
})

//API For the SignUP process

app.post('/signup', async(req, res)=>{
    
    try{
            const newUserRecord = db.ref('users').push();
            const userId = newUserRecord.key;

            await newUserRecord.set({
                email: req.body.email,
                username: req.body.username,
                password: req.body.password
        })

        res.status(201).send({message: "User created successfully!", userId: userId})

        
    } catch (error) {
        console.log("Error in creating user:", error);
        res.status(400).send({error: error.message})
    }
    

})

//API For The Login Process

app.post('/login', async(req, res)=>{

    try{
        const checkEmail = await db.ref('users').orderByChild('email').equalTo(req.body.email).once('value');
        if(!checkEmail.exists()){
            return res.json({exists:false, message: "Email is wrong or user hasn't registered yet!" })
        } else{

            let checkPassword = '';
            let username ='';
            checkEmail.forEach(passowrdSnapshot=>{
                checkPassword = passowrdSnapshot.val().password
                username = passowrdSnapshot.val().username
            })

            if(checkPassword==req.body.password){
                return res.json({exists: true,  message: username})
            }
            else{
                return res.json({exists: false, message: "Password is wrong!"})
            }

        }

    } catch (error) {
        console.log("Error during login:", error);
        res.status(500).json({ error: 'Internal Server Error' });
  }
    
      
})


//API For Saving the Blog information
app.post('/saveBlogData', upload.single('file'), async(req,res)=>{
    
    //console.log("Reached the backend")
    try{
        const file = req.file //multer saves file in "req" not in the req's body

        if(file){

            const fileName = `${req.body.title}_${Date.now()}`
            const fileRef = bucket.file(fileName)
            const fileRefStream = fileRef.createWriteStream({
                metadata: {
                    contentType: file.mimetype
                }
            })

            fileRefStream.on('error', (err)=>{
                console.error("Upload error: ", err)
                res.status(500).send({error: 'Something went wrong while uploading the file!'})
            } )

            fileRefStream.on('finish', async()=>{
                try{

                    const fileURL = await fileRef.getSignedUrl({
                        action: 'read',
                        expires: '03-09-2500'
                    })

                    const newBlog = db.ref(req.body.username).push();
                    const newBlogId = newBlog.key
    
            //console.log("Reached the backend Try Block")
    
                    await newBlog.set({
                        username: req.body.username,
                        title: req.body.title,
                        post: req.body.post,
                        fileURL: fileURL[0]
                    })
                } catch(error){
                    console.error('Error saving blog data:', err);
                    res.status(500).send({ error: 'Error saving blog data' });
                }
            })

            fileRefStream.end(file.buffer)

        } else {
            // If no file is provided
            //console.log("Reached the else block")
            try {
            
              const newBlog = db.ref(req.body.username).push();
              const newBlogId = newBlog.key;
      
              await newBlog.set({
                username: req.body.username,
                title: req.body.title,
                post: req.body.post,
              });
      
              res.status(201).send({ message: 'Blog posted successfully without a file!', blogId: newBlogId });
            } catch (error) {
              console.error('Error saving blog data:', error);  // Corrected error variable
              res.status(500).send({ error: 'Error saving blog data' });
            }
          }

    
    } catch (error) {
        console.log("Error in creating user:", error);
        res.status(400).send({error: error.message})
    }
})

//Fetching Blog Data From The Database
app.get('/fetchBlogData', async(req, res)=>{
    try{
        const snapshot = await db.ref(req.query.username).once('value')
        const fetchedData = snapshot.val()
        //console.log(fetchedData);
        res.json(fetchedData || {})
    } catch(error){
        console.error("Error Fetching Data", error)
        res.status(500).json({error: 'Internal Server Error'})
    }
})


app.listen(port, ()=>{
    console.log(`Server is listening at port: ${port}`)
})