require("dotenv").config()

const express = require("express")

const cors = require("cors")

require("./config/db")

const buildBridgeServer = express()

buildBridgeServer.use(cors())

buildBridgeServer.use(express.json())

buildBridgeServer.get("/", (req, res) => {
    res.status(200).send("Server started")
})

const PORT = process.env.PORT

buildBridgeServer.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);

})